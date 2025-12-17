'use client'

import { useEffect, useRef, useState } from 'react'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Landing/Hero'
import FeaturesAndPricing from '@/components/Landing/FeaturesAndPricing'
import Contact from '@/components/Landing/Contact'
import Footer from '@/components/Landing/Footer'

export default function HorizontalLandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const totalSections = 3 // Hero, Features+Pricing, Contact
  const isScrollingRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      if (isScrollingRef.current) return
      
      if (e.deltaY > 0 && currentSection < totalSections - 1) {
        // Scroll down = next section
        isScrollingRef.current = true
        // If going to third section (signup), navigate to /signup
        if (currentSection === 1) {
          window.location.href = '/signup'
          return
        }
        scrollToSection(currentSection + 1)
        setTimeout(() => { isScrollingRef.current = false }, 800)
      } else if (e.deltaY < 0 && currentSection > 0) {
        // Scroll up = previous section
        isScrollingRef.current = true
        scrollToSection(currentSection - 1)
        setTimeout(() => { isScrollingRef.current = false }, 800)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [currentSection])

  // Add scroll listener to sync state with programmatic scrolls
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft
      const sectionWidth = container.clientWidth
      const newSection = Math.round(scrollLeft / sectionWidth)
      if (newSection !== currentSection) {
        setCurrentSection(newSection)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [currentSection])

  const scrollToSection = (index: number) => {
    const container = containerRef.current
    if (!container) return
    
    // If scrolling to third section (signup), navigate to /signup
    if (index === 2) {
      window.location.href = '/signup'
      return
    }
    
    setCurrentSection(index)
    const sectionWidth = container.clientWidth
    container.scrollTo({
      left: sectionWidth * index,
      behavior: 'smooth'
    })
  }

  return (
    <>
      <Navbar/>
      
      {/* Section indicators at bottom */}
      {/* <div className="fixed bottom-15 left-1/2 -translate-x-1/2 z-50 flex gap-3">
        {Array.from({ length: totalSections }).map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToSection(index)}
            className="w-2 h-2 rounded-full transition-all duration-200"
            style={{
              backgroundColor: index === currentSection ? '#73aa57' : 'rgba(255, 255, 255, 0.3)',
              transform: index === currentSection ? 'scale(1.5)' : 'scale(1)',
            }}
            aria-label={`Go to section ${index + 1}`}
          />
        ))}
      </div> */}

      {/* Horizontal scrolling container */}
      <div
        ref={containerRef}
        data-scroll-container
        className="h-screen overflow-x-scroll overflow-y-hidden snap-x snap-mandatory"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        
        <div className="flex h-full" style={{ width: `${totalSections * 100}vw` }}>
          {/* Section 1: Hero */}
          <div className="w-screen h-screen snap-start flex-shrink-0 overflow-hidden" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            <Hero />
            <Footer />
          </div>

          {/* Section 2: Features + Pricing */}
          <div className="w-screen h-screen snap-start flex-shrink-0 overflow-hidden" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            <FeaturesAndPricing />
            <Footer />
          </div>

          {/* Section 3: Contact */}
          <div className="w-screen h-screen snap-start flex-shrink-0 overflow-hidden" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            <Contact />
            <Footer />
          </div>
        </div>
      </div>
    </>
  )
}