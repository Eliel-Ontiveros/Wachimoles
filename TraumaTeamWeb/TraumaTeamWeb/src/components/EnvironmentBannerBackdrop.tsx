import React from 'react';
import { ENVIRONMENT_BANNERS } from '../data/environment-banners';
import type { EnvironmentType } from '../types/dashboard';

export const EnvironmentBannerBackdrop: React.FC<{ environment: EnvironmentType }> = ({
  environment,
}) => {
  const banner = ENVIRONMENT_BANNERS[environment] ?? ENVIRONMENT_BANNERS.tierra;
  const scrimVars = {
    '--banner-scrim-start': String(banner.scrimStartOpacity),
    '--banner-scrim-mid': String(banner.scrimMidOpacity),
  } as React.CSSProperties;

  return (
    <div className="env-banner-backdrop" aria-hidden="true" style={scrimVars}>
      <img
        className="env-banner-backdrop-img"
        src={banner.src}
        alt=""
        width={809}
        height={185}
      />
    </div>
  );
};
