import React, { useState, useEffect, useRef } from 'react';
import type { ProjectConfig } from './App.js';

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

interface ProjectPanelProps {
    projects: string[];
    config: Record<string, ProjectConfig>;
    onChange: (newConfig: Record<string, ProjectConfig>) => void;
}

export function ProjectPanel({ projects, config, onChange }: ProjectPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const hasAnyColor = projects.some((p) => !!config[p]?.color);

    // Close panel on click outside
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
        onChange({ ...config, [name]: { ...existing, color, style } });
    }

    function clearProject(name: string) {
        const { ...rest } = config[name] ?? {};
        const next = { ...config };
        if (Object.keys(rest).length > 0) {
            next[name] = rest;
        } else {
            delete next[name];
        }
        onChange(next);
        setOpenPickerFor(null);
    }

    function setStyle(name: string, style: 'border' | 'fill' | 'both') {
        const existing = config[name] ?? {};
        onChange({ ...config, [name]: { ...existing, style } });
    }

    function setUrl(name: string, url: string) {
        const existing = config[name] ?? {};
        if (url) {
            onChange({ ...config, [name]: { ...existing, url } });
        } else {
            const { ...rest } = existing;
            const next = { ...config };
            if (Object.keys(rest).length > 0) {
                next[name] = rest;
            } else {
                delete next[name];
            }
            onChange(next);
        }
    }

    return (
        <div className="project-wrapper" ref={ref}>
            <button
                className={`project-btn ${hasAnyColor ? 'active' : ''}`}
                onClick={() => {
                    setIsOpen((o) => !o);
                    setOpenPickerFor(null);
                }}
                title="Configure project colors"
            >
                Projects
            </button>

            {isOpen && (
                <div className="project-panel">
                    <div className="project-panel-header">Projects</div>
                    {projects.length === 0 ? (
                        <div className="project-panel-empty">No projects found in this file.</div>
                    ) : (
                        projects.map((name) => {
                            const cfg = config[name] ?? {};
                            const color = cfg.color;
                            const colorStyle = cfg.style ?? 'border';
                            const pickerOpen = openPickerFor === name;

                            return (
                                <div key={name} className="project-row">
                                    <div className="swatch-picker-wrapper">
                                        <div
                                            className={`project-color-dot ${color ? '' : 'empty'}`}
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
                                                    onClick={() => clearProject(name)}
                                                    title="Clear color"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <span className="project-name-label" title={name}>
                                        #{name}
                                    </span>

                                    <select
                                        className="project-style-select"
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

                                    <input
                                        type="text"
                                        className="project-url-input"
                                        defaultValue={cfg.url ?? ''}
                                        placeholder="url..."
                                        onBlur={(e) => setUrl(name, e.target.value.trim())}
                                        onPointerDown={(e) => e.stopPropagation()}
                                    />
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
