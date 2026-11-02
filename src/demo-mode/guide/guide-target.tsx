import { NavigationContext } from 'expo-router/react-navigation';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native';

import { useDemo } from '../store';
import { STEPS } from './steps';
import { dropTarget, placeTarget, type Rect } from './targets';

/**
 * whether the screen this sits in is the one shown (true outside a navigator). Read when the screen says it is focused
 * or blurred, never while rendering: React Navigation warns that the answer may be stale then.
 */
function useShown() {
  const nav = useContext(NavigationContext);
  const [shown, setShown] = useState(!nav);
  useEffect(() => {
    if (!nav) return;
    const update = () => setShown(nav.isFocused());
    update();
    const offs = [nav.addListener('focus', update), nav.addListener('blur', update)];
    return () => offs.forEach((off) => off());
  }, [nav]);
  return !nav || shown;
}

/**
 * Something the guide can point at. While the guide's step wants `id` (one of its targets, its way in, or its tab) and the screen
 * is shown, where it is goes to `targetsStore`, measured again as it moves; it is forgotten when the step moves on, the
 * screen is left or it unmounts. `anyScreen`: measured whichever screen is shown — a tab button, which React Navigation
 * puts in its own tab's navigation although the tab bar shows over every tab. Outside demo mode it renders its children
 * alone, as if it were not there.
 */
export function GuideTarget({ id, children, style, anyScreen = false }: {
  id: string; children: ReactNode; style?: StyleProp<ViewStyle>; anyScreen?: boolean;
}) {
  const on = useDemo((s) => s.on);
  const wanted = useDemo((s) => {
    const step = s.on && s.guideStep !== null ? STEPS[s.guideStep] : undefined;
    return !!step && (step.targets.includes(id) || id === step.via || id === `tab.${step.tab}`);
  });
  const shown = useShown() || anyScreen;
  const view = useRef<ViewInstance>(null);
  const remeasure = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!wanted || !shown) return;
    let live = true;
    let placed: Rect | undefined;
    const measure = () =>
      view.current?.measureInWindow((x, y, w, h) => {
        if (!live || (!w && !h)) return; // gone meanwhile, or not laid out
        placed = { x, y, w, h };
        placeTarget(id, placed);
      });
    remeasure.current = measure;
    measure();
    // a scroll moves it without a new layout
    const t = setInterval(measure, 300);
    return () => {
      live = false;
      remeasure.current = null;
      clearInterval(t);
      dropTarget(id, placed);
    };
  }, [wanted, shown, id]);

  if (!on) return <>{children}</>;
  return (
    <View ref={view} testID={`guide-target-${id}`} collapsable={false} style={style} onLayout={() => remeasure.current?.()}>
      {children}
    </View>
  );
}
