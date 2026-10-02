// Đọc các <option> con của Select / FilterSelect thành danh sách lựa chọn cho OptionMenu.
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

export interface MenuOption {
  value: string;
  label: ReactNode;
  /** Chữ thuần của nhãn: để tìm và gõ nhảy. */
  text: string;
  disabled: boolean;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

/** Đọc các <option> con (kể cả lồng trong Fragment) thành danh sách lựa chọn. */
export function readOptions(children: ReactNode): MenuOption[] {
  const list: MenuOption[] = [];
  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      const element = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
      if (element.type === 'option') {
        const label = element.props.children;
        list.push({ value: String(element.props.value ?? textOf(label)), label, text: textOf(label), disabled: !!element.props.disabled });
      } else if (element.props.children) walk(element.props.children);
    });
  };
  walk(children);
  return list;
}
