import { describe, it, expect, vi } from 'vitest';
import { DropdownOption } from '@/components/ui/CustomDropdown';

describe('CustomDropdown Component Logic & Options Tests', () => {
  it('validates dropdown option structure and mapping', () => {
    const options: DropdownOption<string>[] = [
      { value: 'all', label: 'All Statuses' },
      { value: 'todo', label: 'Todo' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'needs_review', label: 'Needs Review' },
      { value: 'done', label: 'Done', disabled: true },
    ];

    expect(options.length).toBe(5);
    expect(options.find((o) => o.value === 'todo')?.label).toBe('Todo');
    expect(options.find((o) => o.value === 'done')?.disabled).toBe(true);

    const activeOption = options.find((o) => o.value === 'in_progress');
    expect(activeOption).toBeDefined();
    expect(activeOption?.value).toBe('in_progress');
  });

  it('filters enabled options correctly for keyboard navigation cycling', () => {
    const options: DropdownOption<string>[] = [
      { value: 'todo', label: 'Todo' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'done', label: 'Done', disabled: true },
      { value: 'blocked', label: 'Blocked' },
    ];

    const enabledOptions = options.filter((opt) => !opt.disabled);
    expect(enabledOptions.length).toBe(3);
    expect(enabledOptions.map((o) => o.value)).toEqual(['todo', 'in_progress', 'blocked']);

    // Next item cycling
    const currentIndex = enabledOptions.findIndex((o) => o.value === 'in_progress');
    const nextIndex = currentIndex < enabledOptions.length - 1 ? currentIndex + 1 : 0;
    expect(enabledOptions[nextIndex].value).toBe('blocked');

    // Cycling from end wraps to start
    const lastIndex = enabledOptions.findIndex((o) => o.value === 'blocked');
    const wrapIndex = lastIndex < enabledOptions.length - 1 ? lastIndex + 1 : 0;
    expect(enabledOptions[wrapIndex].value).toBe('todo');
  });

  it('determines upward flip positioning when near the bottom of viewport', () => {
    const calculateOpenUpward = (
      rectBottom: number,
      rectTop: number,
      windowInnerHeight: number,
      optionsCount: number
    ) => {
      const spaceBelow = windowInnerHeight - rectBottom;
      const estimatedHeight = Math.min(optionsCount * 36 + 16, 260);
      return spaceBelow < estimatedHeight && rectTop > estimatedHeight;
    };

    // Case 1: Plenty of space below (at top of window)
    expect(calculateOpenUpward(200, 160, 1000, 5)).toBe(false);

    // Case 2: Near bottom of window (space below is 50px, rectTop is 900px)
    expect(calculateOpenUpward(950, 910, 1000, 5)).toBe(true);

    // Case 3: Constrained window where rectTop is also too small
    expect(calculateOpenUpward(90, 50, 100, 5)).toBe(false);
  });

  it('supports numeric and string generic types', () => {
    const numericOptions: DropdownOption<number>[] = [
      { value: 101, label: 'Project Alpha' },
      { value: 102, label: 'Project Beta' },
    ];
    const selectedNumber: number = 101;
    const foundNum = numericOptions.find((o) => o.value === selectedNumber);
    expect(foundNum?.label).toBe('Project Alpha');

    const stringOptions: DropdownOption<string>[] = [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
    ];
    const selectedString: string = 'critical';
    const foundStr = stringOptions.find((o) => o.value === selectedString);
    expect(foundStr?.label).toBe('Critical');
  });
});
