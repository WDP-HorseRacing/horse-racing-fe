import { Children, Fragment, type ReactNode } from 'react';
import { useI18n } from './I18nContext';

export function T({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return <Fragment>{localize(children, t)}</Fragment>;
}

function localize(node: ReactNode, t: (text: string) => string): ReactNode {
  if (typeof node === 'string') return t(node);
  if (Array.isArray(node)) return Children.map(node, child => localize(child, t));
  return node;
}
