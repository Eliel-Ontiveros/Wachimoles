import earthBanner from '../../../TraumaTeamMovil/assets/images/fondos/banners/EarthBanner.svg';
import marsBanner from '../../../TraumaTeamMovil/assets/images/fondos/banners/MarsBanner.svg';
import moonBanner from '../../../TraumaTeamMovil/assets/images/fondos/banners/MoonBanner.svg';
import shipBanner from '../../../TraumaTeamMovil/assets/images/fondos/banners/ShipBanner.svg';
import stationBanner from '../../../TraumaTeamMovil/assets/images/fondos/banners/StationBanner.svg';
import type { EnvironmentType } from '../types/dashboard';

export interface EnvironmentBannerConfig {
  src: string;
  scrimStartOpacity: number;
  scrimMidOpacity: number;
}

// Reuses mobile's SVG location banners and directional readability scrims per environment.
export const ENVIRONMENT_BANNERS: Record<EnvironmentType, EnvironmentBannerConfig> = {
  nave: {
    src: shipBanner,
    scrimStartOpacity: 0.42,
    scrimMidOpacity: 0.14,
  },
  estacion: {
    src: stationBanner,
    scrimStartOpacity: 0.36,
    scrimMidOpacity: 0.12,
  },
  luna: {
    src: moonBanner,
    scrimStartOpacity: 0.45,
    scrimMidOpacity: 0.16,
  },
  marte: {
    src: marsBanner,
    scrimStartOpacity: 0.56,
    scrimMidOpacity: 0.24,
  },
  tierra: {
    src: earthBanner,
    scrimStartOpacity: 0.64,
    scrimMidOpacity: 0.28,
  },
};
