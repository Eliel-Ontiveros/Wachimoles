import type { ReactNode } from 'react';
import type { BodyCompositionData } from '../hooks/use-body-composition';
import type { BmiCategory, HealthStatusLevel } from '../types/dashboard';
import {
  bmiGauge,
  bodyFatGauge,
  bodyWaterGauge,
  weightGauge,
  type BodyGauge,
} from '../utils/body-composition.ts';
import type { BilateralBand } from '../utils/gauge.ts';
import {
  ActivityIcon,
  DropletsIcon,
  FootprintsIcon,
  LayersIcon,
  RefreshCwIcon,
  SlidersIcon,
  ZapIcon,
} from './Icons';
import { MiniWaveStrip } from './SymptomPulseCards';
import './body-composition.css';

// Generic icons for now; the designer will deliver dedicated ones.

const BMI_LABELS: Record<BmiCategory, string> = {
  underweight: 'Underweight',
  healthy: 'Healthy',
  overweight: 'Overweight',
  obese: 'Obese',
};

function bandStatus(band: BilateralBand): HealthStatusLevel {
  if (band === 'normal') return 'normal';
  if (band === 'low-warning' || band === 'high-warning') return 'warning';
  return 'critical';
}

const formatNumber = (value: number, digits: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function formatWeighingDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface MetricCardProps {
  title: string;
  icon: ReactNode;
  tone: 'tone-sky' | 'tone-rose' | 'tone-amber' | 'tone-emerald';
  value: string;
  unit: string;
  gauge?: BodyGauge | null;
  note?: string;
}

function MetricCard({ title, icon, tone, value, unit, gauge, note }: MetricCardProps) {
  return (
    <article className="symptom-pulse-card body-comp-card">
      <div className="sym-card-head">
        <span className={`sym-icon-box ${tone}`}>{icon}</span>
        <span className="sym-title">{title}</span>
      </div>
      <div className="sym-val-row">
        <strong>{value}</strong>
        <span>{unit}</span>
      </div>
      {gauge ? (
        <MiniWaveStrip
          active
          mode="bilateral"
          status={bandStatus(gauge.band)}
          activeBand={gauge.band}
          pointerPct={gauge.pointerPct}
          bilateralRanges={gauge.legend}
        />
      ) : (
        note && <p className="body-comp-note">{note}</p>
      )}
    </article>
  );
}

/** Scale cards; the data hook lives in App so both layouts share one fetch. */
export function BodyCompositionCards({ data }: { data: BodyCompositionData }) {
  const { status, weighing, profile, error, reload } = data;
  const metrics = weighing?.metrics ?? null;
  const estimated = metrics?.estimated ?? null;
  const sex = profile?.sex ?? null;
  const weighedAt = weighing ? formatWeighingDate(weighing.measuredAt) : '';

  let body: ReactNode;
  if (!weighing) {
    body =
      status === 'loading' ? (
        <p className="body-comp-message" role="status">Loading the latest weighing…</p>
      ) : status === 'ok' ? (
        <p className="body-comp-message">
          No weighings yet. Step on the smart scale to see your body composition.
        </p>
      ) : (
        <div className="body-comp-message is-error" role="alert">
          <span>{status === 'unauthorized' ? 'Access to the scale data was denied (401).' : error}</span>
          <button type="button" className="body-comp-retry" onClick={reload}>
            <RefreshCwIcon size={13} /> Retry
          </button>
        </div>
      );
  } else {
    const ideal = metrics?.exact.idealWeightKg ?? null;
    const toIdeal = metrics?.exact.weightToIdealKg ?? null;
    body = (
      <>
        <div className="symptom-cards-grid">
          <MetricCard
            title="Weight"
            icon={<SlidersIcon size={22} />}
            tone="tone-sky"
            value={formatNumber(weighing.weightKg, 1)}
            unit="kg"
            gauge={metrics ? weightGauge(weighing.weightKg, metrics.exact) : null}
            note="Add your height to the body profile to rate this weight."
          />
          <MetricCard
            title="BMI"
            icon={<ActivityIcon size={22} />}
            tone="tone-rose"
            value={metrics ? formatNumber(metrics.exact.bmi, 1) : '--'}
            unit={metrics ? BMI_LABELS[metrics.exact.bmiCategory] : 'kg/m²'}
            gauge={metrics ? bmiGauge(metrics.exact.bmi) : null}
            note="Needs your height in the body profile."
          />
          <MetricCard
            title="Body fat"
            icon={<LayersIcon size={22} />}
            tone="tone-amber"
            value={estimated ? formatNumber(estimated.bodyFatPercent, 1) : '--'}
            unit={estimated ? `% · ${formatNumber(estimated.fatMassKg, 1)} kg` : '%'}
            gauge={estimated ? bodyFatGauge(estimated.bodyFatPercent, sex) : null}
            note="Needs your age and sex in the body profile."
          />
          <MetricCard
            title="Body water"
            icon={<DropletsIcon size={22} />}
            tone="tone-emerald"
            value={estimated ? formatNumber(estimated.bodyWaterPercent, 1) : '--'}
            unit={estimated ? `% · ${formatNumber(estimated.bodyWaterLiters, 1)} L` : '%'}
            gauge={estimated ? bodyWaterGauge(estimated.bodyWaterPercent, sex) : null}
            note="Needs your age and sex in the body profile."
          />
          <MetricCard
            title="Lean mass"
            icon={<FootprintsIcon size={22} />}
            tone="tone-sky"
            value={estimated ? formatNumber(estimated.leanMassKg, 1) : '--'}
            unit="kg"
            note={
              estimated
                ? `${Math.round((estimated.leanMassKg / weighing.weightKg) * 100)}% of body weight`
                : 'Needs your age and sex in the body profile.'
            }
          />
          <MetricCard
            title="Basal metabolism"
            icon={<ZapIcon size={22} />}
            tone="tone-amber"
            value={estimated ? Math.round(estimated.basalMetabolismKcal).toLocaleString('en-US') : '--'}
            unit="kcal/day"
            note={estimated ? 'Energy burned at rest' : 'Needs your age and sex in the body profile.'}
          />
        </div>

        {ideal !== null && toIdeal !== null && (
          <div className="body-comp-ideal">
            <span>Ideal weight</span>
            <strong>{formatNumber(ideal, 1)} kg</strong>
            <span className="body-comp-ideal-diff">
              {Math.abs(toIdeal) < 0.05
                ? 'On target'
                : `${formatNumber(Math.abs(toIdeal), 1)} kg ${toIdeal > 0 ? 'above' : 'below'}`}
            </span>
          </div>
        )}

        {estimated && (
          <p className="body-comp-footnote">
            Body fat, water, lean mass and metabolism are estimated from weight, height, age and sex;
            the scale only measures weight.
          </p>
        )}
      </>
    );
  }

  return (
    <section className="panel-card body-comp-panel" aria-labelledby="body-comp-title">
      <header className="body-comp-header">
        <div>
          <h2 id="body-comp-title">Body composition</h2>
          <p>
            Smart scale
            {weighedAt && <> · <time dateTime={weighing?.measuredAt}>{weighedAt}</time></>}
          </p>
        </div>
        {weighing && status !== 'ok' && status !== 'loading' && (
          <button type="button" className="body-comp-retry" onClick={reload} title={error ?? undefined}>
            <RefreshCwIcon size={13} /> Retry
          </button>
        )}
      </header>
      {body}
    </section>
  );
}
