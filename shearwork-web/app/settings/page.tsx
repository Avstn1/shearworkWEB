'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import EditableAvatar from '@/components/EditableAvatar'
import { supabase } from '@/utils/supabaseClient'
import SignOutButton from '@/components/SignOutButton'
import { FaCog } from 'react-icons/fa'

interface ProfileData {
  full_name: string
  avatar_url: string
  role: string
  email: string
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [editable, setEditable] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error fetching user:', userError?.message)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error.message)
      } else {
        setProfile({
          full_name: data.full_name ?? 'User',
          avatar_url: data.avatar_url ?? '',
          role: data.role ?? 'Barber',
          email: user.email ?? '',
        })
        setFullName(data.full_name ?? '')
      }

      setLoading(false)
    }

    fetchProfile()
  }, [])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profile) return

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No active user')

      const fileName = `${user.id}_${Date.now()}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id)
      setProfile({ ...profile, avatar_url: publicUrl })
    } catch (err: any) {
      console.error('Upload error:', err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleNameUpdate = async () => {
    if (!profile) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('user_id', user.id)

    if (error) console.error('Error updating name:', error.message)
    else {
      setProfile({ ...profile, full_name: fullName })
      setEditable(false)
    }
  }

  if (loading)
    return (
      <Layout>
        <div className="p-8 text-gray-100">Loading...</div>
      </Layout>
    )

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col items-center">
        <h1 className="text-4xl font-bold text-gray-100 mb-6 mt-12">Settings</h1>

        <div className="max-w-md bg-gray-700 rounded-2xl p-6 shadow-lg space-y-6 text-gray-100 w-full">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <EditableAvatar
              avatarUrl={profile?.avatar_url}
              fullName={profile?.full_name}
              onClick={() => document.getElementById('avatar-input')?.click()}
              size={120}
            />
            <input
              type="file"
              accept="image/*"
              id="avatar-input"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <span className="mt-2 text-sm text-gray-400">
              {uploading ? 'Uploading...' : 'Click avatar to change'}
            </span>
          </div>

          {/* Name */}
          <div className="flex flex-col space-y-2 relative">
            <label className="font-semibold text-gray-300">Full Name</label>
            <div className="flex space-x-2 items-center">
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className={`flex-1 px-3 py-2 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                  editable ? '' : 'opacity-70'
                }`}
                readOnly={!editable}
                style={{ caretColor: editable ? undefined : 'transparent' }}
              />
              <button
                className="text-gray-300 hover:text-teal-400 transition"
                onClick={() => setEditable(!editable)}
                title="Enable editing"
              >
                <FaCog />
              </button>
              {editable && (
                <button
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg font-semibold text-gray-900 transition"
                  onClick={handleNameUpdate}
                >
                  Save
                </button>
              )}
            </div>
          </div>

          {/* Role and Email */}
          <div className="flex flex-col space-y-1">
            <span className="text-gray-400 text-sm">
              Role: {profile?.role || 'Barber'}
            </span>
            <span className="text-gray-400 text-sm">
              Email: {profile?.email || ''}
            </span>
          </div>

          {/* Sign Out */}
          <SignOutButton className="bg-red-600 hover:bg-red-700 w-full mt-4" />
        </div>
      </div>
    </Layout>
  )
}
