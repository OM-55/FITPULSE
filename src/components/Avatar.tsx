interface AvatarProps {
  url?: string | null
  name?: string | null
  username?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-base',
  lg: 'w-16 h-16 text-2xl',
}

export default function Avatar({ url, name, username, size = 'md' }: AvatarProps) {
  const initial = (name?.trim()?.[0] || username?.trim()?.[0] || 'U').toUpperCase()
  const cls = sizeClasses[size]

  if (url) {
    return (
      <img
        src={url}
        alt={name || username || 'User avatar'}
        className={`${cls} rounded-full object-cover border border-border flex-shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${cls} bg-bg-hover border border-border rounded-full flex items-center justify-center font-bold text-accent flex-shrink-0`}
    >
      {initial}
    </div>
  )
}
