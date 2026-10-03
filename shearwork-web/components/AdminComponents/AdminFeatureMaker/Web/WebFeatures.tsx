'use client'

import PlatformFeatures, { type PlatformFeaturesProps } from '../Shared/PlatformFeatures'

export default function WebFeatures(props: Omit<PlatformFeaturesProps, 'platform'>) {
  return <PlatformFeatures {...props} platform="web" />
}
