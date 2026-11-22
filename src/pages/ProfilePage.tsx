import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import toast from 'react-hot-toast'
import {
  Edit3, Loader2, Eye, EyeOff, Dumbbell, UtensilsCrossed, ExternalLink, Copy, Upload, Search
} from 'lucide-react'
import type { WorkoutPlan, DietPlan } from '../types/database'

export default function ProfilePage() {
  const { profile, refreshProfile, user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [showStats, setShowStats] = useState(false)
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([])
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([])

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setVisibility(profile.profile_visibility)
      setShowStats(profile.show_stats)
    }
    loadPublicPlans()
  }, [profile])

  async function loadPublicPlans() {
    if (!user) return
    const [{ data: wp }, { data: dp }] = await Promise.all([
      supabase
        .from('workout_plans')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_premade', false)
        .eq('visibility', 'public'),
      supabase
        .from('diet_plans')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_premade', false)
        .eq('visibility', 'public'),
    ])
    setWorkoutPlans((wp as WorkoutPlan[]) || [])
    setDietPlans((dp as DietPlan[]) || [])
  }

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
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: profErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      if (profErr) throw profErr
      await refreshProfile()
      toast.success('Profile picture updated!')
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          profile_visibility: visibility,
          show_stats: showStats,
        })
        .eq('id', user.id)
      if (error) throw error
      toast.success('Profile updated!')
      await refreshProfile()
      setEditing(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  function copyShareLink() {
    if (!profile) return
    const url = `${window.location.origin}/u/${profile.username}`
    navigator.clipboard.writeText(url)
    toast.success('Public profile URL copied!')
  }

  if (!profile) return null

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/explore"
            className="border border-border hover:border-border-light px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" /> Find Users
          </Link>
          <button
            onClick={copyShareLink}
            className="border border-border hover:border-accent px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </button>
          <Link
            to={`/u/${profile.username}`}
            className="bg-accent hover:bg-accent-hover text-black font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View Public
          </Link>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="flex flex-col items-center gap-2">
            <Avatar url={profile.avatar_url} name={profile.display_name} username={profile.username} size="lg" />
            <label className="text-xs text-accent hover:text-accent-hover cursor-pointer flex items-center gap-1 font-medium">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading...' : 'Change photo'}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
            </label>
          </div>

          <div className="flex-1 w-full">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={60}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={300}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none h-20"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Profile Visibility</label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 pt-5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={showStats}
                      onChange={(e) => setShowStats(e.target.checked)}
                      className="accent-[#84cc16]"
                    />
                    Show achievements on public profile
                  </label>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
                  </button>
                  <button onClick={() => setEditing(false)} className="text-text-muted hover:text-text-secondary text-sm px-4 py-2">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{profile.display_name || profile.username}</h2>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-text-muted hover:text-accent p-1"
                    title="Edit profile"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-text-muted text-sm">@{profile.username}</p>
                {profile.bio && <p className="text-text-secondary text-sm mt-2">{profile.bio}</p>}
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    {profile.profile_visibility === 'public' ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-accent" /> Public profile
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Private profile
                      </>
                    )}
                  </span>
                  <span>• Public URL: /u/{profile.username}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Public Plans */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Your Publicly Shared Plans</h3>
          <Link to="/plans" className="text-xs text-accent hover:text-accent-hover">
            Manage visibility →
          </Link>
        </div>
        {workoutPlans.length === 0 && dietPlans.length === 0 ? (
          <div className="text-center py-8 bg-bg-card border border-border rounded-xl">
            <p className="text-text-muted text-sm">
              No public plans yet. Toggle a plan to "Public" from Workouts, Diet, or Plans to share it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {workoutPlans.map((p) => (
              <div key={p.id} className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <Dumbbell className="w-5 h-5 text-accent" />
                <div>
                  <h4 className="font-medium text-sm">{p.name}</h4>
                  <p className="text-xs text-text-muted">
                    {p.duration_days} days {p.difficulty ? `• ${p.difficulty}` : ''}
                  </p>
                </div>
              </div>
            ))}
            {dietPlans.map((p) => (
              <div key={p.id} className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <UtensilsCrossed className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="font-medium text-sm">{p.name}</h4>
                  <p className="text-xs text-text-muted">
                    {p.duration_days} days {p.difficulty ? `• ${p.difficulty}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
