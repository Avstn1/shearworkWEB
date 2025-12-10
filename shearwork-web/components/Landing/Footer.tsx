// Color palette
const COLORS = {
  background: '#181818',
  cardBg: '#1a1a1a',
  navBg: '#1b1d1b', 
  surface: 'rgba(37, 37, 37, 0.6)',
  surfaceSolid: '#252525',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  green: '#73aa57',
  greenLight: '#5b8f52',
  greenGlow: 'rgba(115, 170, 87, 0.4)',
}

export default function Footer() {
  return (
    <footer 
      className="absolute bottom-0 left-0 right-0 py-3 text-center text-sm"
      style={{
        backgroundColor: 'transparent',
      }}
    >
      <div style={{ 
        filter: 'brightness(0.6)',
        color: '#FFFFFF',
      }}>
        © {new Date().getFullYear()} Corva. All rights reserved.
      </div>
    </footer>
  )
}