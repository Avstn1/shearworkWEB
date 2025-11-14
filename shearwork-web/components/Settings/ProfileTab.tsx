'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import EditableAvatar from '@/components/EditableAvatar' // <- use your component
import { FaCog } from 'react-icons/fa'

export default function ProfileTab() {
  const [profile, setProfile] = useState<any>(null)
  const [commission, setCommission] = useState<number | string>('')
  const [authUser, setAuthUser] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setAuthUser(user)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Failed fetching profile', error)
        return
      }
      if (data) {
        setProfile(data)
        setCommission(data.commission_rate ? data.commission_rate * 100 : '')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const updateCommission = async () => {
    if (!profile) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const value = commission === '' ? null : Number(commission) / 100

      const { error } = await supabase
        .from('profiles')
        .update({ commission_rate: value })
        .eq('user_id', user.id)

      if (error) {
        toast.error('Failed updating commission')
      } else {
        toast.success('Commission saved')
        fetchProfile()
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed updating commission')
    }
  }

  // --- Avatar upload ---
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return toast.error('Not logged in')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload file (upsert)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        console.error(uploadError)
        return toast.error('Upload failed')
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const avatarUrl = urlData.publicUrl

      // Save to profile table
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id)

      if (updateErr) {
        console.error(updateErr)
        return toast.error('Failed saving avatar')
      }

      toast.success('Profile picture updated')
      fetchProfile()
    } catch (err) {
      console.error(err)
      toast.error('Failed updating picture')
    }
  }

  if (!profile || !authUser) return <p>Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Profile Information</h2>
        <button
          onClick={() => {
            /* small utility action — you can wire edit name etc here later */
          }}
          title="Edit profile"
          className="text-[var(--accent-2)] hover:text-[var(--highlight)] transition"
        >
        </button>
      </div>

      {/* Avatar + User Info (uses your EditableAvatar component) */}
      <div className="flex gap-6 items-center">
        <div className="relative">
          <EditableAvatar
            avatarUrl={profile.avatar_url || '/default-avatar.png'}
            fullName={profile.full_name}
            size={96}
            onClick={() => fileInputRef.current?.click()}
          />
          {/* Hidden file input forwarded to the EditableAvatar click */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div>
          <p className="text-lg font-semibold">{profile.full_name}</p>
          <p className="text-sm text-gray-400 capitalize">{profile.role}</p>
          <p className="text-sm text-gray-400 mt-1">{authUser.email}</p>
        </div>
      </div>

      {/* Commission (only for commission barbers) */}
      {profile.barber_type === 'commission' ? (
        <div>
          <label className="text-sm font-medium">Commission Rate (%)</label>
          <div className="flex items-center mt-1">
            <input
              value={commission}
              onChange={e => setCommission(e.target.value)}
              type="number"
              className="bg-black/10 border border-[var(--accent-2)] p-3 rounded-xl w-40"
            />
            <button
              onClick={updateCommission}
              className="ml-4 bg-[var(--highlight)] px-4 py-2 rounded-xl"
            >
              Save
            </button>
          </div>
        </div>
      ) : profile.barber_type === 'rental' ? (
        <div className="p-4 bg-white/5 border border-[var(--accent-2)] rounded-xl">
          <p className="text-sm text-gray-300">
            You are registered as a <span className="font-semibold">Rental Barber</span>.
          </p>
        </div>
      ) : null}
    </div>
  )
}
