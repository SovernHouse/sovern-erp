import { useState, useEffect } from 'react'

// Breakpoints definitions
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

// Media query hook
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    const listener = () => {
      setMatches(media.matches)
    }

    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}

// Get current breakpoint hook
export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState('2xl')

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth

      if (width < BREAKPOINTS.sm) setBreakpoint('xs')
      else if (width < BREAKPOINTS.md) setBreakpoint('sm')
      else if (width < BREAKPOINTS.lg) setBreakpoint('md')
      else if (width < BREAKPOINTS.xl) setBreakpoint('lg')
      else if (width < BREAKPOINTS['2xl']) setBreakpoint('xl')
      else setBreakpoint('2xl')
    }

    // Set initial breakpoint
    handleResize()

    const debouncedResize = debounce(handleResize, 150)
    window.addEventListener('resize', debouncedResize)

    return () => window.removeEventListener('resize', debouncedResize)
  }, [])

  return breakpoint
}

// Mobile detection hook
export const useIsMobile = () => {
  const breakpoint = useBreakpoint()
  return breakpoint === 'xs' || breakpoint === 'sm'
}

// Tablet detection hook
export const useIsTablet = () => {
  const breakpoint = useBreakpoint()
  return breakpoint === 'md'
}

// Desktop detection hook
export const useIsDesktop = () => {
  const breakpoint = useBreakpoint()
  return breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl'
}

// Check specific breakpoint and above
export const useMediaQueryMin = (breakpointName) => {
  const breakpointValue = BREAKPOINTS[breakpointName]
  return useMediaQuery(`(min-width: ${breakpointValue}px)`)
}

// Check specific breakpoint and below
export const useMediaQueryMax = (breakpointName) => {
  const breakpointValue = BREAKPOINTS[breakpointName]
  return useMediaQuery(`(max-width: ${breakpointValue - 1}px)`)
}

// Check for touch device
export const useIsTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        window.matchMedia('(hover: none)').matches ||
        window.matchMedia('(pointer: coarse)').matches
      )
    }

    checkTouch()
    window.addEventListener('resize', checkTouch)
    return () => window.removeEventListener('resize', checkTouch)
  }, [])

  return isTouch
}

// Check for landscape orientation
export const useIsLandscape = () => {
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    const checkLandscape = () => {
      setIsLandscape(window.innerWidth > window.innerHeight)
    }

    checkLandscape()
    window.addEventListener('resize', checkLandscape)
    window.addEventListener('orientationchange', checkLandscape)

    return () => {
      window.removeEventListener('resize', checkLandscape)
      window.removeEventListener('orientationchange', checkLandscape)
    }
  }, [])

  return isLandscape
}

// Utility: debounce function
const debounce = (func, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

export default {
  BREAKPOINTS,
  useMediaQuery,
  useBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useMediaQueryMin,
  useMediaQueryMax,
  useIsTouchDevice,
  useIsLandscape,
}
