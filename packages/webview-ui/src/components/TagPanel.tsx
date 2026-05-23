import React, { useState, useEffect, useRef } from 'react';
import type { TagConfig } from '../HostBridge.js';

const SWATCHES = [
    '#569CD6',
    '#4EC9B0',
    '#89D185',
    '#6A9955',
    '#CCA700',
    '#DCDCAA',
    '#CE9178',
    '#F44747',
    '#F92672',
    '#C586C0',
    '#9CDCFE',
    '#858585',
];

interface TagPanelProps {
    tags: string[];
    config: Record<string, TagConfig>;
    priorityList: string[];
    onChange: (newConfig: Record<string, TagConfig>, newPriorityList: string[]) => void;
}

export function TagPanel({ tags, config, priorityList, onChange }: TagPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const hasAnyColor = tags.some((t) => !!config[t]?.color);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
                setOpenPickerFor(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    function setColor(name: string, color: string) {
        const existing = config[name] ?? {};
        const style = existing.style ?? 'border';
        const newConfig = { ...config, [name]: { ...existing, color, style } };
        // Auto-add to priority list if not already there
        const newList = priorityList.includes(name) ? priorityList : [...priorityList, name];
        onChange(newConfig, newList);
    }

    function clearTag(name: string) {
        const next = { ...config };
        delete next[name];
        const newList = priorityList.filter((t) => t !== name);
        onChange(next, newList);
        setOpenPickerFor(null);
    }

    function setStyle(name: string, style: 'border' | 'fill' | 'both') {
        const existing = config[name] ?? {};
        onChange({ ...config, [name]: { ...existing, style } }, priorityList);
    }

    function moveUp(index: number) {
        if (index === 0) return;
        const next = [...priorityList];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        onChange(config, next);
    }

    function moveDown(index: number) {
        if (index === priorityList.length - 1) return;
        const next = [...priorityList];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        onChange(config, next);
    }

    return (
        <div className="tag-wrapper" ref={ref}>
            <button
                className={`tag-btn ${hasAnyColor ? 'active' : ''}`}
                onClick={() => {
                    setIsOpen((o) => !o);
                    setOpenPickerFor(null);
                }}
                title="Configure tag colors"
            >
                Tags
            </button>

            {isOpen && (
                <div className="tag-panel">
                    <div className="tag-panel-header">Tags</div>
                    {tags.length === 0 ? (
                        <div className="tag-panel-empty">No tags found in this file.</div>
                    ) : (
                        <>
                            {tags.map((name) => {
                                const cfg = config[name] ?? {};
                                const color = cfg.color;
                                const colorStyle = cfg.style ?? 'border';
                                const pickerOpen = openPickerFor === name;

                                return (
                                    <div key={name} className="tag-row">
                                        <div className="swatch-picker-wrapper">
                                            <div
                                                className={`tag-color-dot ${color ? '' : 'empty'}`}
                                                style={color ? { backgroundColor: color } : undefined}
                                                onClick={() =>
                                                    setOpenPickerFor(pickerOpen ? null : name)
                                                }
                                                title="Set color"
                                            />
                                            {pickerOpen && (
                                                <div className="swatch-picker">
                                                    {SWATCHES.map((hex) => (
                                                        <div
                                                            key={hex}
                                                            className={`swatch ${color === hex ? 'active' : ''}`}
                                                            style={{ backgroundColor: hex }}
                                                            onClick={() => {
                                                                setColor(name, hex);
                                                                setOpenPickerFor(null);
                                                            }}
                                                            title={hex}
                                                        />
                                                    ))}
                                                    <div className="swatch-custom-wrapper">
                                                        <span
                                                            className="swatch-action"
                                                            title="Custom color"
                                                        >
                                                            ⊕
                                                        </span>
                                                        <input
                                                            type="color"
                                                            className="swatch-custom-input"
                                                            value={color ?? '#000000'}
                                                            onInput={(e) =>
                                                                setColor(
                                                                    name,
                                                                    (e.target as HTMLInputElement).value
                                                                )
                                                            }
                                                            onChange={(e) =>
                                                                setColor(name, e.target.value)
                                                            }
                                                            title="Pick custom color"
                                                        />
                                                    </div>
                                                    <button
                                                        className="swatch-action"
                                                        onClick={() => clearTag(name)}
                                                        title="Clear color"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <span className="tag-name-label" title={`#${name}`}>
                                            #{name}
                                        </span>

                                        <select
                                            className="tag-style-select"
                                            value={colorStyle}
                                            disabled={!color}
                                            onChange={(e) =>
                                                setStyle(
                                                    name,
                                                    e.target.value as 'border' | 'fill' | 'both'
                                                )
                                            }
                                        >
                                            <option value="border">Border</option>
                                            <option value="fill">Fill</option>
                                            <option value="both">Both</option>
                                        </select>
                                    </div>
                                );
                            })}

                            {priorityList.length > 1 && (
                                <>
                                    <div className="tag-panel-divider" />
                                    <div className="tag-priority-header">Card color priority</div>
                                    {priorityList.map((name, i) => (
                                        <div key={name} className="tag-priority-row">
                                            <span
                                                className="tag-priority-dot"
                                                style={config[name]?.color ? { backgroundColor: config[name].color } : undefined}
                                            />
                                            <span className="tag-priority-name">#{name}</span>
                                            <button
                                                className="tag-priority-arrow"
                                                onClick={() => moveUp(i)}
                                                disabled={i === 0}
                                                title="Move up"
                                            >
                                                ▲
                                            </button>
                                            <button
                                                className="tag-priority-arrow"
                                                onClick={() => moveDown(i)}
                                                disabled={i === priorityList.length - 1}
                                                title="Move down"
                                            >
                                                ▼
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
