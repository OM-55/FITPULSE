import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { COMMON_TIMEZONES } from '../lib/constants'
import Avatar from '../components/Avatar'
import toast from 'react-hot-toast'
import { User, Globe, Bell, Lock, Trash2, Loader2, Save, Check, X, Upload } from 'lucide-react'

export default function SettingsPage() {
  const { user, profile, refreshProfile, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'same' | 'checking' | 'available' | 'taken'>('same')
  const [bio, setBio] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [showStats, setShowStats] = useState(false)
  const [waterGoal, setWaterGoal] = useState(2500)

  const [notifyWorkout, setNotifyWorkout] = useState(true)
  const [notifyMeals, setNotifyMeals] = useState(true)
  const [notifyWater, setNotifyWater] = useState(false)
  const [notifyMissed, setNotifyMissed] = useState(true)
  const [browserNotif, setBrowserNotif] = useState(false)
  const [browserPerm, setBrowserPerm] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  )

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setUsername(profile.username)
      setBio(profile.bio || '')
      setTimezone(profile.timezone || 'UTC')
      setUnits(profile.preferred_units)
      setVisibility(profile.profile_visibility)
      setShowStats(profile.show_stats)
      setWaterGoal(profile.water_goal_ml || 2500)
      setNotifyWorkout(profile.notify_workout)
      setNotifyMeals(profile.notify_meals)
      setNotifyWater(profile.notify_water)
      setNotifyMissed(profile.notify_missed)
      setBrowserNotif(profile.browser_notifications)
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    const clean = username.trim().toLowerCase()
    if (clean === profile.username) {
      setUsernameStatus('same')
      return
    }
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setUsernameStatus('taken')
      return
    }
    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('username_available', { p_username: clean })
      setUsernameStatus(data ? 'available' : 'taken')
    }, 350)
    return () => clearTimeout(timer)
  }, [username, profile])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB')
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` })
        .eq('id', user.id)
      if (pErr) throw pErr
      await refreshProfile()
      toast.success('Avatar updated!')
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function toggleBrowserNotifications(enable: boolean) {
    if (!enable) {
      setBrowserNotif(false)
      return
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser notifications are not supported here')
      return
    }
    const perm = await Notification.requestPermission()
    setBrowserPerm(perm)
    if (perm === 'granted') {
      setBrowserNotif(true)
      toast.success('Browser reminders enabled!')
    } else {
      setBrowserNotif(false)
      toast.error('Notification permission denied. In-app reminders still work.')
    }
  }

  async function handleSave() {
    if (!user || usernameStatus === 'taken') return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          username: username.trim().toLowerCase(),
          bio: bio.trim() || null,
          timezone,
          preferred_units: units,
          profile_visibility: visibility,
          show_stats: showStats,
          water_goal_ml: Math.max(0, Math.min(10000, Number(waterGoal) || 2500)),
          notify_workout: notifyWorkout,
          notify_meals: notifyMeals,
          notify_water: notifyWater,
          notify_missed: notifyMissed,
          browser_notifications: browserNotif,
        })
        .eq('id', user.id)
      if (error) throw error
      toast.success('Settings saved!')
      await refreshProfile()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setChangingPw(true)
    try {
      const { error } = await updatePassword(newPassword)
      if (error) throw error
      toast.success('Password updated!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      toast.error(e.message || 'Failed to update password')
    } finally {
      setChangingPw(false)
    }
  }

  async function handleDeleteAccount() {
    if (!user) return
    const typed = prompt('Type DELETE to permanently delete your account and all data:')
    if (typed !== 'DELETE') return
    setDeleting(true)
    try {
      // Best-effort cleanup of avatar files
      const { data: files } = await supabase.storage.from('avatars').list(user.id)
      if (files && files.length > 0) {
        await supabase.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`))
      }
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw error
      await signOut()
      toast.success('Account deleted')
      navigate('/', { replace: true })
    } catch (err: any) {
      toast.error(err.message || 'Could not delete account')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your account, timezone, privacy, and reminders.</p>
      </div>

      {/* Profile Section */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <User className="w-5 h-5 text-accent" /> Profile
        </h2>

        <div className="flex items-center gap-4">
          <Avatar url={profile?.avatar_url} name={displayName} username={username} size="md" />
          <label className="border border-border hover:border-accent px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1.5">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading...' : 'Upload Profile Picture'}
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Display Name</label>
            <input
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">@</span>
              <input
                value={username}
                maxLength={20}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full bg-bg-primary border border-border rounded-lg pl-8 pr-8 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />}
                {usernameStatus === 'available' && <Check className="w-4 h-4 text-accent" />}
                {usernameStatus === 'taken' && <X className="w-4 h-4 text-danger" />}
              </span>
            </div>
            {usernameStatus === 'taken' && (
              <p className="text-xs text-danger mt-1">Unavailable or invalid (3–20 lowercase chars)</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">Bio</label>
          <textarea
            value={bio}
            maxLength={300}
            onChange={(e) => setBio(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none h-20"
            placeholder="Share your training goals..."
          />
        </div>
      </div>

      {/* Preferences & Privacy */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" /> Schedule & Privacy Preferences
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            >
              {Array.from(new Set([timezone, ...COMMON_TIMEZONES])).map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Daily Water Goal (ml)</label>
            <input
              type="number"
              step={250}
              min={0}
              max={10000}
              value={waterGoal}
              onChange={(e) => setWaterGoal(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Preferred Units</label>
            <div className="flex gap-2">
              {(['metric', 'imperial'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnits(u)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    units === u ? 'bg-accent text-black' : 'bg-bg-hover text-text-secondary'
                  }`}
                >
                  {u === 'metric' ? 'Metric (kg)' : 'Imperial (lb)'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Profile Visibility</label>
            <div className="flex gap-2">
              {(['public', 'private'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${
                    visibility === v ? 'bg-accent text-black' : 'bg-bg-hover text-text-secondary'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center justify-between p-3 bg-bg-primary border border-border rounded-lg cursor-pointer">
          <div>
            <p className="text-sm font-medium">Show summary stats on public profile</p>
            <p className="text-xs text-text-muted">Displays total completed workout days & meals (never individual logs).</p>
          </div>
          <input
            type="checkbox"
            checked={showStats}
            onChange={(e) => setShowStats(e.target.checked)}
            className="accent-[#84cc16] w-4 h-4"
          />
        </label>
      </div>

      {/* Notification Preferences */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-accent" /> Reminders & Notifications
        </h2>
        <p className="text-xs text-text-muted">All reminders are optional and shown on your dashboard.</p>

        {[
          { label: "Today's workout reminder", val: notifyWorkout, set: setNotifyWorkout },
          { label: 'Planned meals reminder', val: notifyMeals, set: setNotifyMeals },
          { label: 'Daily water intake reminder', val: notifyWater, set: setNotifyWater },
          { label: 'Missed checklist item reminder', val: notifyMissed, set: setNotifyMissed },
        ].map((item) => (
          <label
            key={item.label}
            className="flex items-center justify-between p-3 bg-bg-primary border border-border rounded-lg cursor-pointer"
          >
            <span className="text-sm">{item.label}</span>
            <input
              type="checkbox"
              checked={item.val}
              onChange={(e) => item.set(e.target.checked)}
              className="accent-[#84cc16] w-4 h-4"
            />
          </label>
        ))}

        <div className="flex items-center justify-between p-3 bg-bg-primary border border-border rounded-lg">
          <div>
            <p className="text-sm">Browser push notifications</p>
            <p className="text-xs text-text-muted">Permission status: {browserPerm}</p>
          </div>
          <button
            type="button"
            onClick={() => toggleBrowserNotifications(!browserNotif)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              browserNotif ? 'bg-accent text-black' : 'bg-bg-hover text-text-secondary'
            }`}
          >
            {browserNotif ? 'Enabled' : 'Enable'}
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || usernameStatus === 'taken'}
        className="bg-accent hover:bg-accent-hover text-black font-semibold px-6 py-2.5 rounded-lg disabled:opacity-50 flex items-center gap-2 text-sm"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save All Settings
      </button>

      {/* Password Management */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Lock className="w-5 h-5 text-orange-400" /> Password Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            placeholder="New password (min 6 chars)"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            placeholder="Confirm new password"
          />
        </div>
        <button
          onClick={handlePasswordChange}
          disabled={changingPw}
          className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {changingPw && <Loader2 className="w-4 h-4 animate-spin" />} Update Password
        </button>
      </div>

      {/* Account Deletion */}
      <div className="bg-bg-card border border-danger/25 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-1.5 text-danger flex items-center gap-2">
          <Trash2 className="w-5 h-5" /> Delete Account
        </h2>
        <p className="text-text-muted text-sm mb-4">
          Permanently deletes your profile, workout/diet plans, history, and uploaded avatar. This cannot be undone.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="bg-danger/15 text-danger hover:bg-danger/25 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Permanently Delete My Account
        </button>
      </div>
    </div>
  )
}
