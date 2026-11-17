import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'multiple'> & {
  value: string | number;
  onChange: (event: { target: { value: string } }) => void;
};
const EMPTY = '__clario_empty_option__';

/** One accessible web menu for all single-choice fields. */
export function Select({ value, onChange, children, className = '', id, name, disabled, required, 'aria-label': label, 'aria-labelledby': labelledBy }: SelectProps) {
  const options: Array<{ value: string; label: React.ReactNode; disabled: boolean }> = [];
  const collect = (nodes: React.ReactNode) => React.Children.forEach(nodes, node => {
    if (!React.isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean }>(node)) return;
    if (node.type === 'option') options.push({ value: String(node.props.value ?? ''), label: node.props.children, disabled: !!node.props.disabled });
    else collect(node.props.children);
  });
  collect(children);
  return (
    <SelectPrimitive.Root value={String(value) || EMPTY} onValueChange={next => onChange({ target: { value: next === EMPTY ? '' : next } })} name={name} disabled={disabled} required={required}>
      <SelectPrimitive.Trigger id={id} aria-label={label} aria-labelledby={labelledBy} className={`web-select ${className}`}>
        <SelectPrimitive.Value /><SelectPrimitive.Icon className="shrink-0"><ChevronDown size={15} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={5} collisionPadding={12} className="web-select-menu">
          <SelectPrimitive.ScrollUpButton className="flex justify-center p-1"><ChevronUp size={15} /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value || EMPTY} disabled={option.disabled} className="web-select-option">
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="ml-auto shrink-0"><Check size={15} /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>)}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex justify-center p-1"><ChevronDown size={15} /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
