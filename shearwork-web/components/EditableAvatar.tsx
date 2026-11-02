'use client'

import React from 'react'

interface EditableAvatarProps {
  avatarUrl?: string
  fullName?: string
  onClick?: () => void
  size?: number
}

export default function EditableAvatar({
  avatarUrl,
  fullName,
  onClick,
  size = 100,
}: EditableAvatarProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="group relative rounded-full"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="h-full w-full rounded-full object-cover ring-1 ring-white/[0.12] transition group-hover:ring-sage/60"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-raised font-semibold text-ivory ring-1 ring-white/[0.12] transition group-hover:ring-sage/60">
          {fullName?.[0]?.toUpperCase() || 'U'}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-sm font-medium text-ivory opacity-0 transition group-hover:opacity-100">
        Edit
      </div>
    </button>
  )
}
