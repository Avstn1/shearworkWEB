export default function Footer() {
  return (
    <footer 
      className="lg:absolute lg:bottom-0 lg:left-0 lg:right-0 py-3 sm:py-4 text-center text-xs sm:text-sm"
      style={{
        backgroundColor: 'transparent',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="text-gray-400">
        © {new Date().getFullYear()} Corva. All rights reserved. ·{" "}
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-white/20 underline-offset-4 transition hover:text-sage-bright hover:decoration-sage"
        >
          Privacy Policy
        </a>
      </div>
    </footer>
  )
}