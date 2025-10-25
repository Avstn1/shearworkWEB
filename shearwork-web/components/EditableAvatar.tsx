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
      className="rounded-full focus:outline-none relative group"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="rounded-full object-cover w-full h-full hover:ring-2 hover:ring-teal-400 transition"
        />
      ) : (
        <div className="rounded-full bg-teal-400 flex items-center justify-center text-gray-900 font-bold hover:ring-2 hover:ring-teal-400 transition w-full h-full">
          {fullName?.[0]?.toUpperCase() || 'U'}
        </div>
      )}
      <div className="absolute inset-0 bg-black bg-opacity-30 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-sm font-semibold transition">
        Edit
      </div>
    </button>
  )
}
