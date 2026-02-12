'use client'

import { useState, useEffect } from 'react'
import { Search, Phone, ExternalLink, User } from 'lucide-react'

type Barber = {
  full_name: string
  booking_link: string | null
  phone: string | null
}

type BarberSearchProps = {
  initialBarber?: Barber
}

export function BarberSearch({ initialBarber }: BarberSearchProps) {
  const [search, setSearch] = useState(initialBarber?.full_name || '')
  const [barbers, setBarbers] = useState<Barber[]>(initialBarber ? [initialBarber] : [])
  const [loading, setLoading] = useState(false)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(initialBarber || null)

  useEffect(() => {
    if (search.length < 2) {
      setBarbers(initialBarber ? [initialBarber] : [])
      return
    }

    const searchBarbers = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/barbers/search?q=${encodeURIComponent(search)}`)
        const data = await response.json()
        setBarbers(data || [])
      } catch (error) {
        console.error('Error searching barbers:', error)
        setBarbers([])
      }
      setLoading(false)
    }

    const debounce = setTimeout(searchBarbers, 300)
    return () => clearTimeout(debounce)
  }, [search, initialBarber])

  const handleSelectBarber = (barber: Barber) => {
    setSelectedBarber(barber)
    if (barber.booking_link) {
      window.location.href = barber.booking_link
    }
  }

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    const phoneDigits = digits.length === 11 && digits.startsWith('1') 
      ? digits.slice(1) 
      : digits
    
    if (phoneDigits.length === 10) {
      return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`
    }
    return phone
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a] pt-40 pb-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-lime-400/10 border border-lime-400/20">
            <Search className="h-8 w-8 text-lime-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Find Your Barber
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Search by name to book your next appointment
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Search className="h-5 w-5 text-gray-500" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedBarber(null)
            }}
            placeholder="Start typing a barber's name..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-white shadow-sm transition-all placeholder:text-gray-500 focus:border-lime-400/50 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
          />
        </div>

        {/* Search Results Dropdown */}
        {search.length >= 2 && !selectedBarber && (
          <div className="mb-6 overflow-hidden rounded-xl border border-white/10 bg-[#1a1f1b] shadow-2xl">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-lime-400 border-t-transparent" />
                <span className="ml-3 text-sm text-gray-400">Searching...</span>
              </div>
            ) : barbers.length === 0 ? (
              <div className="py-8 text-center">
                <User className="mx-auto h-12 w-12 text-gray-600" />
                <p className="mt-2 text-sm text-gray-400">No barbers found</p>
                <p className="mt-1 text-xs text-gray-500">Try a different name</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {barbers.map((barber, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectBarber(barber)}
                    className="w-full px-6 py-4 text-left transition-colors hover:bg-white/5 focus:bg-white/5 focus:outline-none"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{barber.full_name}</h3>
                        
                        <div className="mt-2 space-y-1.5">
                          {barber.phone ? (
                            <div className="flex items-center text-sm text-gray-400">
                              <Phone className="mr-2 h-4 w-4 text-gray-500" />
                              {formatPhoneNumber(barber.phone)}
                            </div>
                          ) : (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="mr-2 h-4 w-4" />
                              No phone number available
                            </div>
                          )}
                          
                          {barber.booking_link ? (
                            <div className="flex items-center text-sm text-lime-400">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Booking available
                            </div>
                          ) : (
                            <div className="flex items-center text-sm text-gray-600">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              No booking link set
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {barber.booking_link && (
                        <div className="ml-4 flex items-center">
                          <div className="rounded-full bg-lime-400/10 border border-lime-400/20 px-3 py-1 text-xs font-medium text-lime-400">
                            Book now
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Barber (No Booking Link) */}
        {selectedBarber && !selectedBarber.booking_link && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/10">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              
              <h2 className="text-2xl font-bold text-white">
                {selectedBarber.full_name}
              </h2>
              
              <p className="mt-2 text-gray-400">
                This barber hasn't made their booking link available to us.
              </p>
              
              {selectedBarber.phone ? (
                <div className="mt-6">
                  <p className="mb-3 text-sm font-medium text-gray-300">
                    Contact them directly to schedule:
                  </p>
                  <a
                    href={`tel:${selectedBarber.phone}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-lime-400 to-emerald-400 px-6 py-3 text-sm font-semibold text-black shadow-lg hover:shadow-lime-400/20 transition-all focus:outline-none focus:ring-2 focus:ring-lime-400/50"
                  >
                    <Phone className="h-4 w-4" />
                    Call {formatPhoneNumber(selectedBarber.phone)}
                  </a>
                </div>
              ) : (
                <div className="mt-6 rounded-lg bg-white/5 border border-white/10 p-4">
                  <p className="text-sm text-gray-500">
                    No contact information available at this time
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Initial State (No Search) */}
        {!selectedBarber && search.length < 2 && !initialBarber && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
            <Search className="mx-auto h-12 w-12 text-gray-600" />
            <p className="mt-4 text-sm text-gray-400">
              Type at least 2 characters to start searching
            </p>
          </div>
        )}
      </div>
    </div>
  )
}