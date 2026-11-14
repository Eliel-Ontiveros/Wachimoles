import { Pressable, Text, View } from 'react-native';

export type SegmentOption<T extends string> = { value: T; label: string };

/** Selector segmentado accesible (radio group) con aspecto claro/oscuro. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className="flex-row rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-trauma-nightLine dark:bg-trauma-nightBg">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            className={`flex-1 items-center rounded-[10px] px-1 py-1.5 active:opacity-75 ${
              selected ? 'bg-white dark:bg-trauma-nightAlt' : ''
            }`}>
            <Text
              numberOfLines={1}
              className={`font-mono text-[10.5px] ${
                selected
                  ? 'font-bold text-slate-900 dark:text-trauma-nightInk'
                  : 'text-slate-500 dark:text-trauma-nightMuted'
              }`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
