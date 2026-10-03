'use client'

import PlatformFeatures, { type PlatformFeaturesProps } from '../Shared/PlatformFeatures'

export default function MobileFeatures(props: Omit<PlatformFeaturesProps, 'platform'>) {
  return <PlatformFeatures {...props} platform="mobile" />
}
