import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface SubTask {
    text: string;        // Sub-task text (cleaned, without metadata)
    checked: boolean;    // true if [x], false if [ ]
    bodyLineIndex: number;  // Index in card.body array
    absoluteLineNumber: number;  // Actual line number in markdown file
    priority?: 'high' | 'medium' | 'low';  // Parsed priority
    dueDate?: string;    // Parsed due date
    timeEstimate?: string;  // Parsed time estimate
}

interface Card {
    id: string;
    title: string;
    body: string[];
    project: string;
    checked: boolean;
    lineNumber: number;
    column: 'todo' | 'in-progress' | 'done'; // Column/status
    day?: string; // e.g., "Monday" or "Dec 29"
    dueDate?: string; // ISO date string: "2025-01-15"
    priority?: 'high' | 'medium' | 'low';
    timeEstimate?: string; // e.g., "2h", "30m", "1.5h"
    subTasks?: SubTask[];  // Parsed sub-task checkboxes
    subTaskProgress?: {    // Calculated progress
        completed: number;
        total: number;
        percentage: number;
    };
    backlogType?: 'backlog' | 'quarter' | 'year' | 'parking'; // Backlog section type
    backlogSubsection?: string; // e.g., "Now", "Next 2 Weeks", "This Month"
}

interface BoardData {
    todo: Card[];
    inProgress: Card[];
    done: Card[];
    backlog: Card[]; // Cards from backlog sections
    availableDays: string[]; // All day sections that exist (regardless of whether they have cards)
    weekInfo?: {
        week: number;
        year: number;
        startDate: string;
        endDate: string;
    };
}

let kanbanPanel: vscode.WebviewPanel | undefined;
let documentChangeListener: vscode.Disposable | undefined;
let refreshDebounceTimer: NodeJS.Timeout | undefined;
let currentFilePath: string | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('MD Taskboard extension is now active!');

    const disposable = vscode.commands.registerCommand('md-taskboard.openBoard', async (uri?: vscode.Uri) => {
        // Get document either from provided URI (context menu) or active editor
        let document: vscode.TextDocument;

        if (uri) {
            // Called from editor title context menu
            document = await vscode.workspace.openTextDocument(uri);
        } else {
            // Called from command palette
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found. Please open a planner markdown file.');
                return;
            }
            document = editor.document;
        }

        if (document.languageId !== 'markdown') {
            vscode.window.showErrorMessage('Please open a markdown file.');
            return;
        }

        // Check if it's a planner file by looking for frontmatter
        const text = document.getText();
        if (!isPlannerFile(text)) {
            vscode.window.showErrorMessage('This does not appear to be a planner file. Expected frontmatter with week:, year:, and tags: fields.');
            return;
        }

        currentFilePath = document.uri.fsPath;

        // Create or show the Kanban panel
        if (kanbanPanel) {
            kanbanPanel.reveal(vscode.ViewColumn.Beside);
        } else {
            kanbanPanel = vscode.window.createWebviewPanel(
                'plannerKanban',
                'md Taskboard',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            kanbanPanel.onDidDispose(() => {
                kanbanPanel = undefined;
                if (documentChangeListener) {
                    documentChangeListener.dispose();
                    documentChangeListener = undefined;
                }
                if (refreshDebounceTimer) {
                    clearTimeout(refreshDebounceTimer);
                    refreshDebounceTimer = undefined;
                }
            });

            // Handle messages from the webview
            kanbanPanel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.type) {
                        case 'moveCard':
                            await handleMoveCard(message.cardId, message.toColumn);
                            break;
                        case 'addCard':
                            await handleAddCard(message.title);
                            break;
                        case 'refresh':
                            await refreshBoard();
                            break;
                        case 'navigateWeek':
                            await handleNavigateWeek(message.direction);
                            break;
                        case 'openInMarkdown':
                            await vscode.commands.executeCommand('md-taskboard.openInMarkdown', message.cardId);
                            break;
                        case 'editCardPriority':
                            await handleEditCardPriority(message.cardId, message.priority);
                            break;
                        case 'editCardProject':
                            await handleEditCardProject(message.cardId, message.project);
                            break;
                        case 'promptCardProject':
                            await handlePromptCardProject(message.cardId, message.currentProject, message.currentDay);
                            break;
                        case 'changeCardState':
                            await handleChangeCardState(message.cardId, message.newState);
                            break;
                        case 'moveCardToDay':
                            await handleMoveCardToDay(message.cardId, message.targetDay, message.cardProject);
                            break;
                        case 'moveToNextWeek':
                            await handleMoveToNextWeek(message.cardId);
                            break;
                        case 'promptMoveToWeek':
                            await handlePromptMoveToWeek(message.cardId);
                            break;
                        case 'moveToBacklogSection':
                            await handleMoveToBacklogSection(message.cardId, message.targetSection);
                            break;
                        case 'promptCardTitle':
                            await handlePromptCardTitle(message.cardId, message.currentTitle);
                            break;
                        case 'promptCardDueDate':
                            await handlePromptCardDueDate(message.cardId, message.currentDueDate);
                            break;
                        case 'promptCardTimeEstimate':
                            await handlePromptCardTimeEstimate(message.cardId, message.currentEstimate);
                            break;
                        case 'promptCardBody':
                            await handlePromptCardBody(message.cardId, JSON.parse(message.currentBody));
                            break;
                        case 'deleteCard':
                            await handleDeleteCard(message.cardId);
                            break;
                        case 'toggleSubTask':
                            await handleToggleSubTask(message.lineNumber, message.checked);
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );
        }

        // Set up document change listener for real-time updates
        if (documentChangeListener) {
            documentChangeListener.dispose();
        }

        // Debounced refresh function (500ms delay)
        const debouncedRefresh = () => {
            if (refreshDebounceTimer) {
                clearTimeout(refreshDebounceTimer);
            }
            refreshDebounceTimer = setTimeout(() => {
                refreshBoard();
            }, 500); // 500ms debounce - adjust if needed
        };

        // Listen to document changes
        documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
            // Only refresh if the changed document is our current file
            if (event.document.uri.fsPath === currentFilePath) {
                debouncedRefresh();
            }
        });

        // Load and display the board
        await refreshBoard();
    });

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand('md-taskboard.refreshBoard', async () => {
        if (!kanbanPanel || !currentFilePath) {
            vscode.window.showWarningMessage('No active Kanban board to refresh.');
            return;
        }
        await refreshBoard();
        vscode.window.showInformationMessage('Board refreshed!');
    });

    // Register open in markdown command
    const openInMarkdownCommand = vscode.commands.registerCommand('md-taskboard.openInMarkdown', async (cardId?: string) => {
        if (!currentFilePath) {
            vscode.window.showErrorMessage('No markdown file is associated with the board.');
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(currentFilePath);
            const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);

            // If cardId is provided, jump to that line
            if (cardId && cardId.startsWith('card-')) {
                const lineNumber = parseInt(cardId.split('-')[1]);
                if (!isNaN(lineNumber) && lineNumber >= 0) {
                    const position = new vscode.Position(lineNumber, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening markdown file: ${error}`);
            console.error('Error in openInMarkdown:', error);
        }
    });

    context.subscriptions.push(disposable, refreshCommand, openInMarkdownCommand);
}

function isPlannerFile(text: string): boolean {
    // Check for YAML frontmatter with required fields
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = text.match(frontmatterRegex);

    if (!match) {
        return false;
    }

    const frontmatter = match[1];
    return frontmatter.includes('week:') &&
           frontmatter.includes('year:') &&
           frontmatter.includes('tags:');
}

async function refreshBoard() {
    if (!kanbanPanel || !currentFilePath) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const boardData = parseMarkdown(fileContent);
        kanbanPanel.webview.html = getWebviewContent(boardData);
    } catch (error) {
        vscode.window.showErrorMessage(`Error loading md Taskboard: ${error}`);
        console.error('Error refreshing board:', error);
    }
}

// Metadata parsing functions
function extractDueDate(title: string): { dueDate?: string, cleanTitle: string } {
    let cleanTitle = title;
    let dueDate: string | undefined;

    // Pattern 1: � 2025-01-15
    const emojiPattern = /�\s*(\d{4}-\d{2}-\d{2})/;
    let match = cleanTitle.match(emojiPattern);
    if (match) {
        dueDate = match[1];
        cleanTitle = cleanTitle.replace(emojiPattern, '').trim();
        return { dueDate, cleanTitle };
    }

    // Pattern 2: due:2025-01-15
    const duePattern = /due:\s*(\d{4}-\d{2}-\d{2})/i;
    match = cleanTitle.match(duePattern);
    if (match) {
        dueDate = match[1];
        cleanTitle = cleanTitle.replace(duePattern, '').trim();
        return { dueDate, cleanTitle };
    }

    // Pattern 3: [2025-01-15]
    const bracketPattern = /\[(\d{4}-\d{2}-\d{2})\]/;
    match = cleanTitle.match(bracketPattern);
    if (match) {
        dueDate = match[1];
        cleanTitle = cleanTitle.replace(bracketPattern, '').trim();
        return { dueDate, cleanTitle };
    }

    return { cleanTitle };
}

function extractPriority(title: string): { priority?: 'high' | 'medium' | 'low', cleanTitle: string } {
    let cleanTitle = title;
    let priority: 'high' | 'medium' | 'low' | undefined;

    // Pattern 1: �, � High, !!!, !!! High, P1
    // Check for !!! first (must not be followed by another !)
    const tripleExclamPattern = /!!!(?!!)(\s+High)?/i;
    if (tripleExclamPattern.test(cleanTitle)) {
        priority = 'high';
        cleanTitle = cleanTitle.replace(tripleExclamPattern, '').trim();
        return { priority, cleanTitle };
    }

    // Check for red circle or P1
    const highEmojiPattern = /(�(\s+High)?|P1\b)/i;
    if (highEmojiPattern.test(cleanTitle)) {
        priority = 'high';
        cleanTitle = cleanTitle.replace(highEmojiPattern, '').trim();
        return { priority, cleanTitle };
    }

    // Pattern 2: �, � Medium, !!, !! Medium, P2
    // Check for !! first (must not be followed by another !)
    const doubleExclamPattern = /!!(?!!)(\s+(Medium|Med))?/i;
    if (doubleExclamPattern.test(cleanTitle)) {
        priority = 'medium';
        cleanTitle = cleanTitle.replace(doubleExclamPattern, '').trim();
        return { priority, cleanTitle };
    }

    // Check for yellow circle or P2
    const mediumEmojiPattern = /(�(\s+(Medium|Med))?|P2\b)/i;
    if (mediumEmojiPattern.test(cleanTitle)) {
        priority = 'medium';
        cleanTitle = cleanTitle.replace(mediumEmojiPattern, '').trim();
        return { priority, cleanTitle };
    }

    // Pattern 3: �, � Low, P3
    const lowEmojiPattern = /(�(\s+Low)?|P3\b)/i;
    if (lowEmojiPattern.test(cleanTitle)) {
        priority = 'low';
        cleanTitle = cleanTitle.replace(lowEmojiPattern, '').trim();
        return { priority, cleanTitle };
    }

    // Single ! for low (must not be preceded or followed by another !)
    const singleExclamPattern = /(?<![!])!(?![!])(\s+Low)?/i;
    if (singleExclamPattern.test(cleanTitle)) {
        priority = 'low';
        cleanTitle = cleanTitle.replace(singleExclamPattern, '').trim();
        return { priority, cleanTitle };
    }

    return { cleanTitle };
}

function extractTimeEstimate(title: string): { timeEstimate?: string, cleanTitle: string } {
    let cleanTitle = title;
    let timeEstimate: string | undefined;

    // Pattern 1: ⏱️ 2h, ⏱️ 30m, ⏱️ 1.5h
    const emojiPattern = /⏱️\s*(\d+(?:\.\d+)?)(h|m)/i;
    let match = cleanTitle.match(emojiPattern);
    if (match) {
        timeEstimate = `${match[1]}${match[2].toLowerCase()}`;
        cleanTitle = cleanTitle.replace(emojiPattern, '').trim();
        return { timeEstimate, cleanTitle };
    }

    // Pattern 2: est:2h, est:30m
    const estPattern = /est:\s*(\d+(?:\.\d+)?)(h|m)/i;
    match = cleanTitle.match(estPattern);
    if (match) {
        timeEstimate = `${match[1]}${match[2].toLowerCase()}`;
        cleanTitle = cleanTitle.replace(estPattern, '').trim();
        return { timeEstimate, cleanTitle };
    }

    return { cleanTitle };
}

function extractStatusTag(title: string): { column: 'todo' | 'in-progress' | 'done', cleanTitle: string } {
    let cleanTitle = title;
    let column: 'todo' | 'in-progress' | 'done' = 'todo'; // Default

    // Pattern: #wip, #in-progress, #doing (case-insensitive)
    const wipPattern = /#(wip|in-progress|doing)\b/i;
    const match = cleanTitle.match(wipPattern);
    if (match) {
        column = 'in-progress';
        cleanTitle = cleanTitle.replace(wipPattern, '').trim();
    }

    return { column, cleanTitle };
}

function parseMetadata(title: string): { cleanTitle: string, column: 'todo' | 'in-progress' | 'done', dueDate?: string, priority?: 'high' | 'medium' | 'low', timeEstimate?: string } {
    let cleanTitle = title;
    let column: 'todo' | 'in-progress' | 'done' = 'todo';
    let dueDate: string | undefined;
    let priority: 'high' | 'medium' | 'low' | undefined;
    let timeEstimate: string | undefined;

    // Extract all metadata (order independent)
    const statusResult = extractStatusTag(cleanTitle);
    cleanTitle = statusResult.cleanTitle;
    column = statusResult.column;

    const dueDateResult = extractDueDate(cleanTitle);
    cleanTitle = dueDateResult.cleanTitle;
    dueDate = dueDateResult.dueDate;

    const priorityResult = extractPriority(cleanTitle);
    cleanTitle = priorityResult.cleanTitle;
    priority = priorityResult.priority;

    const timeEstimateResult = extractTimeEstimate(cleanTitle);
    cleanTitle = timeEstimateResult.cleanTitle;
    timeEstimate = timeEstimateResult.timeEstimate;

    return { cleanTitle, column, dueDate, priority, timeEstimate };
}

function parseMarkdown(content: string): BoardData {
    const lines = content.split('\n');
    const cards: Card[] = [];

    // Parse frontmatter for week info
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    let weekInfo: BoardData['weekInfo'] = undefined;

    if (match) {
        const frontmatter = match[1];
        const weekMatch = frontmatter.match(/week:\s*(\d+)/);
        const yearMatch = frontmatter.match(/year:\s*(\d+)/);
        const startDateMatch = frontmatter.match(/start_date:\s*(.+)/);
        const endDateMatch = frontmatter.match(/end_date:\s*(.+)/);

        if (weekMatch && yearMatch) {
            weekInfo = {
                week: parseInt(weekMatch[1]),
                year: parseInt(yearMatch[1]),
                startDate: startDateMatch ? startDateMatch[1].trim() : '',
                endDate: endDateMatch ? endDateMatch[1].trim() : ''
            };
            console.log(`Parsed frontmatter: Week ${weekInfo.week}, Year ${weekInfo.year}`);
        }
    }

    let inDailyPlanner = false;
    let inDateSection = false;
    let inBacklogSection = false;
    let currentBacklogType: 'backlog' | 'quarter' | 'year' | 'parking' | null = null;
    let currentBacklogSubsection: string | null = null;
    let currentProject = '';
    let currentDay = '';
    const availableDays: string[] = []; // Track all day sections found

    console.log('Starting markdown parse...');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Track sections - only level 2 headings (##) not level 3 (###)
        if (trimmed === '## Daily Planner') {
            inDailyPlanner = true;
            inBacklogSection = false;
            currentBacklogType = null;
            currentBacklogSubsection = null;
            console.log(`Line ${i}: Found ## Daily Planner`);
            continue;
        } else if (trimmed === '## Backlog') {
            inBacklogSection = true;
            currentBacklogType = 'backlog';
            inDailyPlanner = false;
            inDateSection = false;
            console.log(`Line ${i}: Found ## Backlog`);
            continue;
        } else if (trimmed === '## This Quarter') {
            inBacklogSection = true;
            currentBacklogType = 'quarter';
            inDailyPlanner = false;
            inDateSection = false;
            console.log(`Line ${i}: Found ## This Quarter`);
            continue;
        } else if (trimmed === '## This Year') {
            inBacklogSection = true;
            currentBacklogType = 'year';
            inDailyPlanner = false;
            inDateSection = false;
            console.log(`Line ${i}: Found ## This Year`);
            continue;
        } else if (trimmed === '## Parking Lot / Unsorted Notes' || trimmed === '## Parking Lot') {
            inBacklogSection = true;
            currentBacklogType = 'parking';
            inDailyPlanner = false;
            inDateSection = false;
            console.log(`Line ${i}: Found ## Parking Lot`);
            continue;
        } else if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
            // Exit all sections on other level-2 headings
            if (inDailyPlanner) {
                console.log(`Line ${i}: Exiting Daily Planner, found: ${trimmed}`);
            }
            if (inBacklogSection) {
                console.log(`Line ${i}: Exiting backlog section, found: ${trimmed}`);
            }
            inDailyPlanner = false;
            inDateSection = false;
            inBacklogSection = false;
            currentBacklogType = null;
            currentBacklogSubsection = null;
            continue;
        }

        // Level 3 headings (### Date or ### Backlog Subsection)
        if (inDailyPlanner && trimmed.startsWith('### ')) {
            inDateSection = true;
            currentProject = '';
            // Extract day name (e.g., "Monday" from "### Monday, December 29, 2025")
            currentDay = trimmed.substring(4).split(',')[0].trim();
            if (currentDay && !availableDays.includes(currentDay)) {
                availableDays.push(currentDay);
            }
            console.log(`Line ${i}: Found date section: ${trimmed}, day = ${currentDay}`);
            continue;
        } else if (inBacklogSection && trimmed.startsWith('### ')) {
            // Backlog subsection (e.g., "### Now", "### Next 2 Weeks", "### This Month")
            currentBacklogSubsection = trimmed.substring(4).trim();
            console.log(`Line ${i}: Found backlog subsection: ${currentBacklogSubsection}`);
            continue;
        }

        // Parse project headers (bold text) within date or backlog sections
        if ((inDateSection || inBacklogSection) && trimmed.startsWith('**') && trimmed.endsWith('**')) {
            currentProject = trimmed.replace(/\*\*/g, '');
            console.log(`Line ${i}: Found project: ${currentProject}`);
            continue;
        }

        // Parse checkboxes - only top-level (not indented)
        // Indented checkboxes are part of card body, not separate cards
        const isTopLevelCheckbox = (inDateSection || inBacklogSection) &&
                                   (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) &&
                                   !line.startsWith('  ') && !line.startsWith('\t');

        if (isTopLevelCheckbox) {
            const checked = trimmed.startsWith('- [x]');
            const rawTitle = trimmed.substring(6).trim(); // Remove "- [ ] " or "- [x] "

            // Parse metadata from title
            const metadata = parseMetadata(rawTitle);

            // Determine column: if checked, it's done; otherwise use metadata.column
            const column: 'todo' | 'in-progress' | 'done' = checked ? 'done' : metadata.column;

            console.log(`Line ${i}: Found card: "${metadata.cleanTitle}" (column: ${column}, checked: ${checked}, project: ${currentProject}, due: ${metadata.dueDate}, priority: ${metadata.priority}, estimate: ${metadata.timeEstimate})`)

            // Collect sub-bullets (body content)
            const body: string[] = [];
            let j = i + 1;
            while (j < lines.length) {
                const nextLine = lines[j];
                const nextTrimmed = nextLine.trim();

                // Stop at blank line, heading, or new project
                if (nextTrimmed === '' ||
                    nextTrimmed.startsWith('#') ||
                    nextTrimmed.startsWith('**')) {
                    break;
                }

                // Stop at next TOP-LEVEL checkbox (not indented)
                // Indented checkboxes are sub-items, not the next card
                const isTopLevelCheckbox = (nextTrimmed.startsWith('- [ ]') || nextTrimmed.startsWith('- [x]')) &&
                                          !nextLine.startsWith('  ') && !nextLine.startsWith('\t');
                if (isTopLevelCheckbox) {
                    break;
                }

                // Include sub-bullets (indented lines)
                if (nextLine.startsWith('  ') || nextLine.startsWith('\t')) {
                    body.push(nextTrimmed);
                }
                j++;
            }

            // Parse sub-task checkboxes from body content
            const subTasks: SubTask[] = [];
            body.forEach((line, index) => {
                // Detect checkbox patterns: "- [ ]" or "- [x]"
                const checkboxMatch = line.match(/^-\s*\[([ xX])\]\s*(.*)$/);
                if (checkboxMatch) {
                    const rawSubTaskText = checkboxMatch[2].trim();
                    // Parse metadata from sub-task text
                    const subTaskMeta = parseMetadata(rawSubTaskText);

                    subTasks.push({
                        text: subTaskMeta.cleanTitle,  // Use cleaned text without metadata
                        checked: checkboxMatch[1].toLowerCase() === 'x',
                        bodyLineIndex: index,
                        absoluteLineNumber: i + 1 + index,  // Main task line + body offset
                        priority: subTaskMeta.priority,
                        dueDate: subTaskMeta.dueDate,
                        timeEstimate: subTaskMeta.timeEstimate
                    });
                }
            });

            // Calculate progress if sub-tasks exist
            let subTaskProgress = undefined;
            if (subTasks.length > 0) {
                const completed = subTasks.filter(st => st.checked).length;
                subTaskProgress = {
                    completed,
                    total: subTasks.length,
                    percentage: Math.round((completed / subTasks.length) * 100)
                };
            }

            cards.push({
                id: `card-${i}`,
                title: metadata.cleanTitle,
                body,
                project: currentProject,
                checked,
                column,
                lineNumber: i,
                day: currentDay,
                dueDate: metadata.dueDate,
                priority: metadata.priority,
                timeEstimate: metadata.timeEstimate,
                subTasks: subTasks.length > 0 ? subTasks : undefined,
                subTaskProgress,
                backlogType: currentBacklogType || undefined,
                backlogSubsection: currentBacklogSubsection || undefined
            });
        }
    }

    // Separate into three columns and backlog
    const todo = cards.filter(c => c.column === 'todo' && !c.backlogType);
    const inProgress = cards.filter(c => c.column === 'in-progress' && !c.backlogType);
    const done = cards.filter(c => c.column === 'done' && !c.backlogType);
    const backlog = cards.filter(c => c.backlogType);

    console.log(`Parse complete: Found ${cards.length} total cards (${todo.length} todo, ${inProgress.length} in-progress, ${done.length} done, ${backlog.length} backlog)`);
    console.log(`Available days: ${availableDays.join(', ')}`);

    return { todo, inProgress, done, backlog, availableDays, weekInfo };
}

// Helper function to check if document has unsaved changes
function checkDocumentDirty(): boolean {
    if (!currentFilePath) {
        return false;
    }

    // Find the document in VS Code's open documents
    const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === currentFilePath);

    if (doc && doc.isDirty) {
        vscode.window.showWarningMessage(
            'Please save your changes in the text editor before using the MD Taskboard. Unsaved changes may be overwritten.',
            'Save Now'
        ).then(selection => {
            if (selection === 'Save Now') {
                doc.save();
            }
        });
        return true;
    }

    return false;
}

async function handleMoveCard(cardId: string, toColumn: 'todo' | 'in-progress' | 'done') {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const lineNumber = parseInt(cardId.split('-')[1]);
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');

        // Update the checkbox and/or status tag on the specific line
        if (lineNumber >= 0 && lineNumber < lines.length) {
            let line = lines[lineNumber];

            // Helper to remove #wip tag if present
            const removeWipTag = (text: string) => {
                return text.replace(/#(wip|in-progress|doing)(?=\s|$)/gi, '').replace(/\s+/g, ' ').trim();
            };

            // Helper to add #wip tag if not present
            const addWipTag = (text: string) => {
                // Remove any existing wip tag first
                text = removeWipTag(text);
                // Add #wip at the end
                return text + ' #wip';
            };

            if (toColumn === 'done') {
                // Mark as checked and remove #wip tag
                line = line.replace(/^(\s*)-\s*\[\s*\]\s*/m, '$1- [x] ');
                line = removeWipTag(line);
            } else if (toColumn === 'in-progress') {
                // Uncheck and add #wip tag
                line = line.replace(/^(\s*)-\s*\[[xX]\]\s*/m, '$1- [ ] ');
                line = addWipTag(line);
            } else { // toColumn === 'todo'
                // Uncheck and remove #wip tag
                line = line.replace(/^(\s*)-\s*\[[xX]\]\s*/m, '$1- [ ] ');
                line = removeWipTag(line);
            }

            lines[lineNumber] = line;

            // Write back to file
            fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

            // Refresh the board after a short delay to allow file watcher to trigger
            setTimeout(() => refreshBoard(), 100);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error updating card: ${error}`);
        console.error('Error in handleMoveCard:', error);
    }
}

async function handleAddCard(title: string) {
    if (!currentFilePath || !title.trim()) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');

        console.log('handleAddCard: Starting search for insertion point under ## Daily Planner');

        // Find the first date section (### day) under ## Daily Planner
        let insertIndex = -1;
        let inDailyPlanner = false;
        let foundDateSection = false;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            if (trimmed === '## Daily Planner') {
                inDailyPlanner = true;
                console.log(`handleAddCard: Found ## Daily Planner at line ${i}`);
            } else if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
                inDailyPlanner = false;
            }

            // Find first date section (### Monday, ### Tuesday, etc.)
            if (inDailyPlanner && trimmed.startsWith('### ')) {
                foundDateSection = true;
                insertIndex = i + 1;
                console.log(`handleAddCard: Found date section ${trimmed} at line ${i}, insertIndex = ${insertIndex}`);

                // Skip any blank lines or project headers to find insertion point
                while (insertIndex < lines.length &&
                       (lines[insertIndex].trim() === '' ||
                        lines[insertIndex].trim().startsWith('**') ||
                        lines[insertIndex].trim().startsWith('####'))) {
                    insertIndex++;
                }
                break;
            }
        }

        if (insertIndex === -1 || !foundDateSection) {
            vscode.window.showErrorMessage('Could not find a date section (### day) under ## Daily Planner');
            return;
        }

        // Insert the new card
        lines.splice(insertIndex, 0, `- [ ] ${title.trim()}`);

        // Write back to file
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

        // Refresh the board
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error adding card: ${error}`);
        console.error('Error in handleAddCard:', error);
    }
}

async function handleEditCardPriority(cardId: string, priority: 'high' | 'medium' | 'low' | null) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');
        const lineNumber = parseInt(cardId.split('-')[1]);

        if (lineNumber >= 0 && lineNumber < lines.length) {
            let line = lines[lineNumber];

            // Remove all existing priority markers (!!!, !!, !, emojis, P1/P2/P3, etc.)
            line = line.replace(/!!!(?!!)(\s+High)?/gi, '');  // !!!
            line = line.replace(/!!(?!!)(\s+(Medium|Med))?/gi, '');  // !!
            line = line.replace(/(?<![!])!(?![!])(\s+Low)?/gi, '');  // !
            line = line.replace(/�(\s+High)?/gi, '');
            line = line.replace(/�(\s+(Medium|Med))?/gi, '');
            line = line.replace(/�(\s+Low)?/gi, '');
            line = line.replace(/\bP[123]\b/g, '');
            line = line.replace(/\s+/g, ' ').trim();  // Clean up spaces

            // Add new priority marker at the END if specified
            if (priority) {
                const priorityMarker = priority === 'high' ? '!!!' : priority === 'medium' ? '!!' : '!';
                line = line + ' ' + priorityMarker;
            }

            lines[lineNumber] = line;
            fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

            // Refresh the board
            setTimeout(() => refreshBoard(), 100);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error editing card priority: ${error}`);
        console.error('Error in handleEditCardPriority:', error);
    }
}

async function handleEditCardProject(cardId: string, project: string | null, currentDay?: string) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');
        const lineNumber = parseInt(cardId.split('-')[1]);

        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('Invalid card line number');
            return;
        }

        // Extract the task line and any sub-bullets (indented lines following it)
        const taskLines: string[] = [lines[lineNumber]];
        let i = lineNumber + 1;
        while (i < lines.length && (lines[i].trim() === '' || lines[i].startsWith('  '))) {
            taskLines.push(lines[i]);
            i++;
        }

        // Remove any inline **Project** markers from the task line
        taskLines[0] = taskLines[0].replace(/\s*\*\*[^*]+\*\*/g, '');
        taskLines[0] = taskLines[0].replace(/\s+/g, ' ').trim();

        // Remove the task from its current location
        lines.splice(lineNumber, taskLines.length);

        // Find the target day section and #### Work section
        let targetIndex = -1;
        let inDailyPlanner = false;
        let foundTargetDay = false;
        let inTargetDayWork = false;
        let foundMatchingProject = false;

        for (let j = 0; j < lines.length; j++) {
            const trimmed = lines[j].trim();

            // Track when we're in Daily Planner section
            if (trimmed === '## Daily Planner') {
                inDailyPlanner = true;
            } else if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
                inDailyPlanner = false;
                foundTargetDay = false;
                inTargetDayWork = false;
            }

            // Look for the target day (format: "### Monday, December 29, 2025")
            if (inDailyPlanner && trimmed.startsWith('### ') && currentDay && trimmed.includes(currentDay)) {
                foundTargetDay = true;
            }

            // Found #### Work section under the target day
            if (foundTargetDay && trimmed === '#### Work') {
                inTargetDayWork = true;
                // If no project, insert right after Work section
                if (!project || project === 'none') {
                    targetIndex = j + 1;
                    while (targetIndex < lines.length && lines[targetIndex].trim() === '') {
                        targetIndex++;
                    }
                    break;
                }
                continue;
            }

            // If we have a project, look for matching **Project** header
            if (inTargetDayWork && project && project !== 'none') {
                if (trimmed === `**${project}**`) {
                    foundMatchingProject = true;
                    targetIndex = j + 1;
                    // Skip blank lines after project header
                    while (targetIndex < lines.length && lines[targetIndex].trim() === '') {
                        targetIndex++;
                    }
                    break;
                }
                // Stop searching if we hit another section
                if (trimmed.startsWith('####') || trimmed.startsWith('###')) {
                    break;
                }
            }
        }

        // If we have a project but didn't find the header, create it at top of Work section
        if (project && project !== 'none' && !foundMatchingProject && targetIndex === -1) {
            // Find Work section again to insert project header
            inDailyPlanner = false;
            foundTargetDay = false;
            for (let j = 0; j < lines.length; j++) {
                const trimmed = lines[j].trim();
                if (trimmed === '## Daily Planner') {
                    inDailyPlanner = true;
                } else if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
                    inDailyPlanner = false;
                    foundTargetDay = false;
                }
                if (inDailyPlanner && trimmed.startsWith('### ') && currentDay && trimmed.includes(currentDay)) {
                    foundTargetDay = true;
                }
                if (foundTargetDay && trimmed === '#### Work') {
                    targetIndex = j + 1;
                    // Skip blank lines
                    while (targetIndex < lines.length && lines[targetIndex].trim() === '') {
                        targetIndex++;
                    }
                    // Insert project header
                    lines.splice(targetIndex, 0, `**${project}**`);
                    targetIndex++; // Task goes after the new header
                    break;
                }
            }
        }

        if (targetIndex === -1) {
            vscode.window.showErrorMessage(`Could not find #### Work section${currentDay ? ' under ' + currentDay : ''}`);
            return;
        }

        // Insert the task at the target location
        lines.splice(targetIndex, 0, ...taskLines);

        // Write back to file
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

        // Refresh the board
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error editing card project: ${error}`);
        console.error('Error in handleEditCardProject:', error);
    }
}

async function handlePromptCardProject(cardId: string, currentProject: string, currentDay?: string) {
    if (!currentFilePath) {
        return;
    }

    const newProject = await vscode.window.showInputBox({
        prompt: 'Enter project name',
        value: currentProject && currentProject !== 'none' ? currentProject : '',
        placeHolder: 'Project name (leave empty to remove project assignment)'
    });

    if (newProject !== undefined) {
        await handleEditCardProject(cardId, newProject.trim() || null, currentDay);
    }
}

async function handleChangeCardState(cardId: string, newState: 'todo' | 'in-progress' | 'done') {
    // This reuses the existing handleMoveCard logic
    await handleMoveCard(cardId, newState);
}

async function handleMoveCardToDay(cardId: string, targetDay: string, cardProject?: string) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');
        const lineNumber = parseInt(cardId.split('-')[1]);

        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('Invalid card line number');
            return;
        }

        // Check if there's a project header above this task
        let projectHeaderLine = '';
        let removeStart = lineNumber;
        let isStandaloneProject = false;

        // Look for project header on the line above
        if (lineNumber > 0 && lines[lineNumber - 1].trim().startsWith('**') && lines[lineNumber - 1].trim().endsWith('**')) {
            projectHeaderLine = lines[lineNumber - 1].trim();

            // Check if this is the only task under this project header
            // by looking for the next non-empty, non-indented line after this task
            let nextTaskIndex = lineNumber + 1;
            while (nextTaskIndex < lines.length && (lines[nextTaskIndex].trim() === '' || lines[nextTaskIndex].startsWith('  ') || lines[nextTaskIndex].startsWith('\t'))) {
                nextTaskIndex++;
            }

            // If the next line is not a task (doesn't start with -), then this is the only task under the project
            isStandaloneProject = nextTaskIndex >= lines.length || !lines[nextTaskIndex].trim().startsWith('- ');

            if (isStandaloneProject) {
                removeStart = lineNumber - 1;
            }
        }

        // Extract the task line and any sub-bullets (indented lines following it)
        const taskLines: string[] = [lines[lineNumber]];
        let i = lineNumber + 1;
        while (i < lines.length && (lines[i].trim() === '' || lines[i].startsWith('  '))) {
            taskLines.push(lines[i]);
            i++;
        }

        // Remove the task (and project header if standalone) from its current location
        const removeCount = isStandaloneProject ? taskLines.length + 1 : taskLines.length;
        lines.splice(removeStart, removeCount);

        // Determine which project to use - extracted header takes precedence
        const projectToUse = projectHeaderLine || (cardProject && cardProject !== 'none' ? cardProject : null);
        const projectHeaderToInsert = projectHeaderLine || (cardProject && cardProject !== 'none' ? `**${cardProject}**` : null);

        // Find the target day section
        let targetIndex = -1;
        let inDailyPlanner = false;
        let foundMatchingProject = false;

        for (let j = 0; j < lines.length; j++) {
            const trimmed = lines[j].trim();

            // Track when we're in Daily Planner section
            if (trimmed === '## Daily Planner') {
                inDailyPlanner = true;
            } else if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
                inDailyPlanner = false;
            }

            // Look for the target day (format: "### Monday, December 29, 2025")
            if (inDailyPlanner && trimmed.startsWith('### ') && trimmed.includes(targetDay)) {

                // If no project, insert right after day section
                if (!projectToUse) {
                    targetIndex = j + 1;
                    // Skip blank lines, Work headers, etc
                    while (targetIndex < lines.length &&
                           (lines[targetIndex].trim() === '' ||
                            lines[targetIndex].trim().startsWith('####'))) {
                        targetIndex++;
                    }
                    break;
                }

                // If we have a project, look for matching project header in this day
                for (let k = j + 1; k < lines.length; k++) {
                    const dayTrimmed = lines[k].trim();

                    // Stop if we hit another day or section
                    if (dayTrimmed.startsWith('###') || dayTrimmed.startsWith('## ')) {
                        break;
                    }

                    // Found matching project header
                    if (projectHeaderToInsert && dayTrimmed === projectHeaderToInsert) {
                        foundMatchingProject = true;
                        targetIndex = k + 1;
                        // Skip blank lines after project header
                        while (targetIndex < lines.length && lines[targetIndex].trim() === '') {
                            targetIndex++;
                        }
                        break;
                    }
                }

                // If we have a project but didn't find the header, insert at top of day
                if (projectToUse && !foundMatchingProject) {
                    targetIndex = j + 1;
                    // Skip blank lines and Work headers
                    while (targetIndex < lines.length &&
                           (lines[targetIndex].trim() === '' ||
                            lines[targetIndex].trim().startsWith('####'))) {
                        targetIndex++;
                    }
                }
                break;
            }
        }

        if (targetIndex === -1) {
            vscode.window.showErrorMessage(`Could not find ${targetDay} section`);
            return;
        }

        // Insert project header if needed (not already present)
        if (projectHeaderToInsert && !foundMatchingProject) {
            lines.splice(targetIndex, 0, projectHeaderToInsert);
            targetIndex += 1;
        }

        // Insert the task at the target location
        lines.splice(targetIndex, 0, ...taskLines);

        // Write back to file
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

        // Refresh the board
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error moving card to day: ${error}`);
        console.error('Error in handleMoveCardToDay:', error);
    }
}

async function handleToggleSubTask(lineNumber: number, checked: boolean) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');

        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('Invalid line number');
            return;
        }

        let line = lines[lineNumber];

        // Toggle checkbox in the sub-task line
        if (checked) {
            // Check the box: [ ] -> [x]
            line = line.replace(/^(\s*)-\s*\[\s*\]/, '$1- [x]');
        } else {
            // Uncheck the box: [x] -> [ ]
            line = line.replace(/^(\s*)-\s*\[[xX]\]/, '$1- [ ]');
        }

        lines[lineNumber] = line;
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

        // Refresh board after short delay
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error toggling sub-task: ${error}`);
        console.error('Error in handleToggleSubTask:', error);
    }
}

async function handlePromptCardTimeEstimate(cardId: string, currentEstimate?: string) {
    const newEstimate = await vscode.window.showInputBox({
        prompt: 'Edit time estimate (e.g., 2h, 30m, 1.5h)',
        value: currentEstimate || '',
        placeHolder: 'e.g., 2h, 30m, 1.5h',
        validateInput: (value) => {
            if (!value.trim()) {
                return null; // Allow empty (removes estimate)
            }
            if (!/^\d+(?:\.\d+)?[hm]$/i.test(value.trim())) {
                return 'Format must be: number + h or m (e.g., 2h, 30m, 1.5h)';
            }
            return null;
        }
    });

    if (newEstimate !== undefined) {
        const normalizedEstimate = newEstimate.trim().toLowerCase() || null;
        await handleEditCardTimeEstimate(cardId, normalizedEstimate);
    }
}

async function handleEditCardTimeEstimate(cardId: string, timeEstimate: string | null) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');
        const lineNumber = parseInt(cardId.split('-')[1]);

        let line = lines[lineNumber];

        // Remove all existing time estimate patterns
        line = line.replace(/⏱️\s*(\d+(?:\.\d+)?)(h|m)/gi, '');
        line = line.replace(/est:\s*(\d+(?:\.\d+)?)(h|m)/gi, '');
        line = line.replace(/\s+/g, ' ').trim();

        // Add new time estimate at end (emoji format for visibility)
        if (timeEstimate) {
            line = line + ' ⏱️ ' + timeEstimate;
        }

        lines[lineNumber] = line;
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error editing time estimate: ${error}`);
    }
}

async function handlePromptCardDueDate(cardId: string, currentDueDate?: string) {
    const newDueDate = await vscode.window.showInputBox({
        prompt: 'Edit due date (YYYY-MM-DD format)',
        value: currentDueDate || '',
        placeHolder: 'e.g., 2025-01-15',
        validateInput: (value) => {
            if (!value.trim()) {
                return null; // Allow empty (removes date)
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
                return 'Date must be in YYYY-MM-DD format (e.g., 2025-01-15)';
            }
            // Validate actual date
            const date = new Date(value.trim());
            if (isNaN(date.getTime())) {
                return 'Invalid date';
            }
            return null;
        }
    });

    if (newDueDate !== undefined) {
        const normalizedDate = newDueDate.trim() || null;
        await handleEditCardDueDate(cardId, normalizedDate);
    }
}

async function handleEditCardDueDate(cardId: string, dueDate: string | null) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');
        const lineNumber = parseInt(cardId.split('-')[1]);

        let line = lines[lineNumber];

        // Remove all existing due date patterns
        line = line.replace(/�\s*(\d{4}-\d{2}-\d{2})/g, '');
        line = line.replace(/due:\s*(\d{4}-\d{2}-\d{2})/gi, '');
        line = line.replace(/\[(\d{4}-\d{2}-\d{2})\]/g, '');
        line = line.replace(/\s+/g, ' ').trim();

        // Add new due date at end (emoji format for visibility)
        if (dueDate) {
            line = line + ' � ' + dueDate;
        }

        lines[lineNumber] = line;
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error editing due date: ${error}`);
    }
}

async function handlePromptCardTitle(cardId: string, currentTitle: string) {
    const newTitle = await vscode.window.showInputBox({
        prompt: 'Edit task title',
        value: currentTitle,
        placeHolder: 'Task description',
        validateInput: (value) => {
            if (!value || !value.trim()) {
                return 'Title cannot be empty';
            }
            return null;
        }
    });

    if (newTitle !== undefined && newTitle.trim()) {
        await handleEditCardTitle(cardId, newTitle.trim());
    }
}

async function handleEditCardTitle(cardId: string, newTitle: string) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');
        const lineNumber = parseInt(cardId.split('-')[1]);

        let line = lines[lineNumber];

        // Strategy: Extract all metadata, replace title, reconstruct line
        // 1. Extract checkbox and status
        const checkboxMatch = line.match(/^(\s*-\s*\[[x ]\]\s*)/);
        if (!checkboxMatch) {
            vscode.window.showErrorMessage('Invalid task line format');
            return;
        }
        const checkbox = checkboxMatch[1];

        // 2. Extract project (bold text after checkbox)
        let project = '';
        const projectMatch = line.match(/\*\*([^*]+)\*\*/);
        if (projectMatch) {
            project = `**${projectMatch[1]}** `;
        }

        // 3. Extract all metadata markers (keep at end)
        const metadata: string[] = [];

        // Due date patterns
        const dueDateMatch = line.match(/�\s*(\d{4}-\d{2}-\d{2})/);
        if (dueDateMatch) {
            metadata.push(`� ${dueDateMatch[1]}`);
        }

        const duePatternMatch = line.match(/due:\s*(\d{4}-\d{2}-\d{2})/i);
        if (duePatternMatch && !dueDateMatch) {
            metadata.push(`due:${duePatternMatch[1]}`);
        }

        const bracketDateMatch = line.match(/\[(\d{4}-\d{2}-\d{2})\]/);
        if (bracketDateMatch && !dueDateMatch && !duePatternMatch) {
            metadata.push(`[${bracketDateMatch[1]}]`);
        }

        // Time estimate patterns
        const timeEmojiMatch = line.match(/⏱️\s*(\d+(?:\.\d+)?[hm])/i);
        if (timeEmojiMatch) {
            metadata.push(`⏱️ ${timeEmojiMatch[1]}`);
        }

        const estMatch = line.match(/est:\s*(\d+(?:\.\d+)?[hm])/i);
        if (estMatch && !timeEmojiMatch) {
            metadata.push(`est:${estMatch[1]}`);
        }

        // Priority patterns (use triple, then double, then single to avoid overlaps)
        if (/!!!(?!!)/.test(line)) {
            metadata.push('!!!');
        } else if (/!!(?!!)/.test(line)) {
            metadata.push('!!');
        } else if (/(?<![!])!(?![!])/.test(line)) {
            metadata.push('!');
        } else if (/�/.test(line)) {
            metadata.push('�');
        } else if (/�/.test(line)) {
            metadata.push('�');
        } else if (/�/.test(line)) {
            metadata.push('�');
        } else if (/\bP1\b/.test(line)) {
            metadata.push('P1');
        } else if (/\bP2\b/.test(line)) {
            metadata.push('P2');
        } else if (/\bP3\b/.test(line)) {
            metadata.push('P3');
        }

        // Status tags
        const statusMatch = line.match(/#(wip|in-progress|doing)/i);
        if (statusMatch) {
            metadata.push(`#${statusMatch[1]}`);
        }

        // 4. Reconstruct line
        const metadataString = metadata.length > 0 ? ' ' + metadata.join(' ') : '';
        line = checkbox + project + newTitle + metadataString;

        lines[lineNumber] = line;
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error editing title: ${error}`);
        console.error('Error in handleEditCardTitle:', error);
    }
}

async function handlePromptCardBody(cardId: string, currentBody: string[]) {
    if (!currentFilePath) {
        return;
    }

    // Convert body array to multi-line string for editing
    // Remove leading "- " from each line for cleaner editing
    const bodyText = currentBody
        .map(line => line.replace(/^- /, ''))
        .join('\n');

    // Create temporary document for multi-line editing
    const doc = await vscode.workspace.openTextDocument({
        content: bodyText,
        language: 'markdown'
    });

    // Show document in editor
    const editor = await vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false
    });

    // Create status bar buttons for Save and Cancel
    const saveButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
    saveButton.text = "$(check) Save Description";
    saveButton.tooltip = "Save changes to card description";
    saveButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    saveButton.command = 'md-taskboard.saveDescriptionEdit';
    saveButton.show();

    const cancelButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
    cancelButton.text = "$(close) Cancel";
    cancelButton.tooltip = "Discard changes to card description";
    cancelButton.command = 'md-taskboard.cancelDescriptionEdit';
    cancelButton.show();

    // Create a promise that resolves when user clicks Save or Cancel
    return new Promise<void>((resolve) => {
        const saveCommand = vscode.commands.registerCommand('md-taskboard.saveDescriptionEdit', async () => {
            const editedText = editor.document.getText();
            saveButton.dispose();
            cancelButton.dispose();
            saveCommand.dispose();
            cancelCommand.dispose();
            await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
            await handleEditCardBody(cardId, editedText);
            resolve();
        });

        const cancelCommand = vscode.commands.registerCommand('md-taskboard.cancelDescriptionEdit', async () => {
            saveButton.dispose();
            cancelButton.dispose();
            saveCommand.dispose();
            cancelCommand.dispose();
            await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
            resolve();
        });
    });
}

async function handleEditCardBody(cardId: string, newBodyText: string) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');
        const lineNumber = parseInt(cardId.split('-')[1]);

        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('Invalid card line number');
            return;
        }

        // Parse new body text into lines
        const newBodyLines = newBodyText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)  // Remove empty lines
            .map(line => {
                // Add "- " prefix if not already present
                if (!line.startsWith('- ')) {
                    return '  - ' + line;  // 2 spaces indent + dash + space
                } else {
                    return '  ' + line;  // 2 spaces indent (already has dash)
                }
            });

        // Extract current task line + body lines
        const taskLine = lines[lineNumber];
        let bodyEndIndex = lineNumber + 1;
        while (bodyEndIndex < lines.length &&
               (lines[bodyEndIndex].trim() === '' || lines[bodyEndIndex].startsWith('  '))) {
            bodyEndIndex++;
        }

        // Remove old task + body
        lines.splice(lineNumber, bodyEndIndex - lineNumber);

        // Insert task + new body
        const newTaskBlock = [taskLine, ...newBodyLines];
        lines.splice(lineNumber, 0, ...newTaskBlock);

        // Write back to file
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

        // Refresh the board
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error editing card body: ${error}`);
        console.error('Error in handleEditCardBody:', error);
    }
}

async function handleDeleteCard(cardId: string) {
    if (!currentFilePath) {
        return;
    }

    // Show confirmation dialog
    const result = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this task? This cannot be undone.',
        { modal: true },
        'Delete',
        'Cancel'
    );

    if (result !== 'Delete') {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');
        const lineNumber = parseInt(cardId.split('-')[1]);

        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('Invalid card line number');
            return;
        }

        // Extract the task line and any sub-bullets (indented lines following it)
        let bodyEndIndex = lineNumber + 1;
        while (bodyEndIndex < lines.length &&
               (lines[bodyEndIndex].trim() === '' || lines[bodyEndIndex].startsWith('  '))) {
            bodyEndIndex++;
        }

        // Remove task + body
        lines.splice(lineNumber, bodyEndIndex - lineNumber);

        // Write back to file
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

        // Refresh the board
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error deleting card: ${error}`);
        console.error('Error in handleDeleteCard:', error);
    }
}

async function handleNavigateWeek(direction: number) {
    if (!currentFilePath) {
        return;
    }

    try {
        // Parse current week/year from frontmatter
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

        if (!frontmatterMatch) {
            vscode.window.showErrorMessage('Could not find frontmatter in current file');
            return;
        }

        const frontmatter = frontmatterMatch[1];
        const weekMatch = frontmatter.match(/week:\s*(\d+)/);
        const yearMatch = frontmatter.match(/year:\s*(\d+)/);

        if (!weekMatch || !yearMatch) {
            vscode.window.showErrorMessage('Could not parse week/year from frontmatter');
            return;
        }

        let currentWeek = parseInt(weekMatch[1]);
        let currentYear = parseInt(yearMatch[1]);

        // Calculate target week/year
        let targetWeek = currentWeek + direction;
        let targetYear = currentYear;

        // Handle year boundaries (simplified - assumes 52 weeks per year)
        if (targetWeek > 52) {
            targetWeek = 1;
            targetYear++;
        } else if (targetWeek < 1) {
            targetWeek = 52;
            targetYear--;
        }

        // Construct target file path using user's convention
        const basePath = path.dirname(path.dirname(currentFilePath)); // Go up to /planner/
        const weekPadded = String(targetWeek).padStart(2, '0');
        const targetPath = path.join(
            basePath,
            `${targetYear}`,
            `week-${weekPadded}`,
            `${targetYear}-${weekPadded}-weekly-plan.md`
        );

        console.log(`Navigating from week ${currentWeek}/${currentYear} to week ${targetWeek}/${targetYear}`);
        console.log(`Target path: ${targetPath}`);

        // Check if file exists
        if (!fs.existsSync(targetPath)) {
            // Create directory if needed
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Generate week template
            const template = generateWeekTemplate(targetWeek, targetYear);
            fs.writeFileSync(targetPath, template, 'utf8');
            console.log(`Created new week file: ${targetPath}`);
        }

        // Open the file
        const uri = vscode.Uri.file(targetPath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);

        // Update current file path and reload board
        currentFilePath = targetPath;
        await refreshBoard();
    } catch (error) {
        vscode.window.showErrorMessage(`Error navigating to week: ${error}`);
        console.error('Error in handleNavigateWeek:', error);
    }
}

function generateWeekTemplate(week: number, year: number): string {
    // Calculate start/end dates for the week
    const startDate = getWeekStartDate(week, year);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const quarter = Math.ceil((startDate.getMonth() + 1) / 3);

    // Generate daily sections for weekdays (Monday-Friday)
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dailySections = days.map((day, index) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + index);
        const monthName = date.toLocaleString('en-US', { month: 'long' });
        const dayNum = date.getDate();
        return `### ${day}, ${monthName} ${dayNum}, ${year}\n`;
    }).join('\n');

    return `---
week: ${week}
year: ${year}
quarter: Q${quarter}
start_date: ${formatDate(startDate)}
end_date: ${formatDate(endDate)}
tags: [planner, weekly]
---

## Daily Planner

${dailySections}

## Backlog

### Now

### Next 2 Weeks

### This Month

## This Quarter

## This Year

## Parking Lot / Unsorted Notes
`;
}

function getWeekStartDate(week: number, year: number): Date {
    // ISO 8601 week date system:
    // Week 1 is the week with the first Thursday of the year
    // Weeks start on Monday

    // Find January 4th (which is always in week 1)
    const jan4 = new Date(year, 0, 4);

    // Find the Monday of week 1
    const dayOffset = (jan4.getDay() + 6) % 7; // Days since Monday (0 = Monday, 6 = Sunday)
    const week1Monday = new Date(year, 0, 4 - dayOffset);

    // Calculate the target week's Monday
    const targetMonday = new Date(week1Monday);
    targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);

    return targetMonday;
}

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function ensureWeekdaySections(lines: string[], week: number, year: number): string[] {
    // Find the Daily Planner section
    let dailyPlannerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '## Daily Planner') {
            dailyPlannerIndex = i;
            break;
        }
    }

    if (dailyPlannerIndex === -1) {
        // No Daily Planner section, can't auto-create weekdays
        return lines;
    }

    // Calculate start date for the week
    const startDate = getWeekStartDate(week, year);

    // Define all weekdays in order
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Find all existing day sections and their positions
    const existingDays = new Map<string, number>(); // day name -> line index
    let nextSectionIndex = lines.length; // Default to end of file

    for (let i = dailyPlannerIndex + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('## ')) {
            // Hit next major section, stop looking
            nextSectionIndex = i;
            break;
        }
        if (trimmed.startsWith('### ')) {
            // Extract day name from heading like "### Monday, January 6, 2026"
            const dayMatch = trimmed.match(/^###\s+(\w+)/);
            if (dayMatch && weekdays.includes(dayMatch[1])) {
                existingDays.set(dayMatch[1], i);
            }
        }
    }

    // Insert missing weekdays in proper order
    let lastInsertIndex = dailyPlannerIndex + 1;

    // Skip blank lines after Daily Planner heading
    while (lastInsertIndex < lines.length && lines[lastInsertIndex].trim() === '') {
        lastInsertIndex++;
    }

    weekdays.forEach((day, index) => {
        if (!existingDays.has(day)) {
            // Find insertion point: after the previous day or at the start
            let insertIndex = lastInsertIndex;

            // Look for the position after any existing earlier days
            for (let j = 0; j < index; j++) {
                const previousDay = weekdays[j];
                if (existingDays.has(previousDay)) {
                    const prevDayIndex = existingDays.get(previousDay)!;
                    // Find the end of the previous day's section (next ### or ## heading)
                    let endOfPrevDay = prevDayIndex + 1;
                    while (endOfPrevDay < nextSectionIndex &&
                           !lines[endOfPrevDay].trim().startsWith('###') &&
                           !lines[endOfPrevDay].trim().startsWith('##')) {
                        endOfPrevDay++;
                    }
                    insertIndex = Math.max(insertIndex, endOfPrevDay);
                }
            }

            // Generate the date for this weekday
            const date = new Date(startDate);
            date.setDate(date.getDate() + index);
            const monthName = date.toLocaleString('en-US', { month: 'long' });
            const dayNum = date.getDate();
            const heading = `### ${day}, ${monthName} ${dayNum}, ${year}`;

            // Insert heading and a blank line after it
            lines.splice(insertIndex, 0, heading, '');

            // Update indices for later insertions
            nextSectionIndex += 2;
            existingDays.forEach((value, key) => {
                if (value >= insertIndex) {
                    existingDays.set(key, value + 2);
                }
            });
            existingDays.set(day, insertIndex);
            lastInsertIndex = insertIndex + 2;
        }
    });

    return lines;
}

async function handleMoveToNextWeek(cardId: string) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        // Parse current week/year
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

        if (!frontmatterMatch) {
            vscode.window.showErrorMessage('Could not find frontmatter');
            return;
        }

        const frontmatter = frontmatterMatch[1];
        const weekMatch = frontmatter.match(/week:\s*(\d+)/);
        const yearMatch = frontmatter.match(/year:\s*(\d+)/);

        if (!weekMatch || !yearMatch) {
            vscode.window.showErrorMessage('Could not parse week/year');
            return;
        }

        const currentWeek = parseInt(weekMatch[1]);
        const currentYear = parseInt(yearMatch[1]);

        // Calculate next week
        let nextWeek = currentWeek + 1;
        let nextYear = currentYear;

        if (nextWeek > 52) {
            nextWeek = 1;
            nextYear++;
        }

        // Move card to target week
        await moveCardToWeek(cardId, nextWeek, nextYear);
    } catch (error) {
        vscode.window.showErrorMessage(`Error moving to next week: ${error}`);
        console.error('Error in handleMoveToNextWeek:', error);
    }
}

async function handlePromptMoveToWeek(cardId: string) {
    if (!currentFilePath) {
        return;
    }

    try {
        // Prompt for week number
        const weekInput = await vscode.window.showInputBox({
            prompt: 'Move task to which week?',
            placeHolder: 'Enter week number (1-52)',
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1 || num > 52) {
                    return 'Please enter a valid week number (1-52)';
                }
                return null;
            }
        });

        if (!weekInput) {
            return; // User cancelled
        }

        const targetWeek = parseInt(weekInput);

        // Parse current year
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

        if (!frontmatterMatch) {
            vscode.window.showErrorMessage('Could not find frontmatter');
            return;
        }

        const frontmatter = frontmatterMatch[1];
        const yearMatch = frontmatter.match(/year:\s*(\d+)/);

        if (!yearMatch) {
            vscode.window.showErrorMessage('Could not parse year');
            return;
        }

        const currentYear = parseInt(yearMatch[1]);

        // Move card to target week (same year)
        await moveCardToWeek(cardId, targetWeek, currentYear);
    } catch (error) {
        vscode.window.showErrorMessage(`Error moving to week: ${error}`);
        console.error('Error in handlePromptMoveToWeek:', error);
    }
}

async function moveCardToWeek(cardId: string, targetWeek: number, targetYear: number) {
    if (!currentFilePath) {
        return;
    }

    try {
        // Extract card details from current file
        const lineNumber = parseInt(cardId.split('-')[1]);
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');

        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('Invalid card line number');
            return;
        }

        // Get the card line and any body lines
        const cardLine = lines[lineNumber];
        const cardBody: string[] = [];
        let i = lineNumber + 1;
        while (i < lines.length) {
            const line = lines[i];
            if (line.startsWith('  ') || line.startsWith('\t')) {
                cardBody.push(line);
                i++;
            } else {
                break;
            }
        }

        // Extract project if it's on the line above
        let projectLine = '';
        if (lineNumber > 0 && lines[lineNumber - 1].trim().startsWith('**')) {
            projectLine = lines[lineNumber - 1];
        }

        // Remove card from current file
        const removeCount = 1 + cardBody.length;
        lines.splice(lineNumber, removeCount);
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

        // Construct target file path
        const basePath = path.dirname(path.dirname(currentFilePath));
        const weekPadded = String(targetWeek).padStart(2, '0');
        const targetPath = path.join(
            basePath,
            `${targetYear}`,
            `week-${weekPadded}`,
            `${targetYear}-${weekPadded}-weekly-plan.md`
        );

        // Check if target file exists, create if not
        if (!fs.existsSync(targetPath)) {
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            const template = generateWeekTemplate(targetWeek, targetYear);
            fs.writeFileSync(targetPath, template, 'utf8');
        }

        // Read target file
        const targetContent = fs.readFileSync(targetPath, 'utf8');
        let targetLines = targetContent.split('\n');

        // Ensure all weekday sections exist
        targetLines = ensureWeekdaySections(targetLines, targetWeek, targetYear);

        // Find Monday section in target file
        let insertIndex = -1;
        for (let j = 0; j < targetLines.length; j++) {
            const trimmed = targetLines[j].trim();
            if (trimmed.startsWith('### Monday')) {
                insertIndex = j + 1;
                // Skip blank lines
                while (insertIndex < targetLines.length && targetLines[insertIndex].trim() === '') {
                    insertIndex++;
                }
                break;
            }
        }

        if (insertIndex === -1) {
            vscode.window.showErrorMessage('Could not find Monday section in target week');
            return;
        }

        // Insert project header if needed
        if (projectLine) {
            targetLines.splice(insertIndex, 0, projectLine);
            insertIndex++;
        }

        // Insert card line
        targetLines.splice(insertIndex, 0, cardLine);
        insertIndex++;

        // Insert body lines
        cardBody.forEach(bodyLine => {
            targetLines.splice(insertIndex, 0, bodyLine);
            insertIndex++;
        });

        // Write target file
        fs.writeFileSync(targetPath, targetLines.join('\n'), 'utf8');

        // Refresh current board
        setTimeout(() => refreshBoard(), 100);

        vscode.window.showInformationMessage(`Task moved to Week ${targetWeek}, ${targetYear} (Monday)`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error moving card to week: ${error}`);
        console.error('Error in moveCardToWeek:', error);
    }
}

async function handleMoveToBacklogSection(cardId: string, targetSection: string) {
    if (!currentFilePath) {
        return;
    }

    // Check if document has unsaved changes
    if (checkDocumentDirty()) {
        return;
    }

    try {
        // Extract card details from current file
        const lineNumber = parseInt(cardId.split('-')[1]);
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        const lines = fileContent.split('\n');

        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('Invalid card line number');
            return;
        }

        // Get the card line and any body lines
        const cardLine = lines[lineNumber];
        const cardBody: string[] = [];
        let i = lineNumber + 1;
        while (i < lines.length) {
            const line = lines[i];
            if (line.startsWith('  ') || line.startsWith('\t')) {
                cardBody.push(line);
                i++;
            } else {
                break;
            }
        }

        // Extract project if it's on the line above
        let projectLine = '';
        let removeStart = lineNumber;
        if (lineNumber > 0 && lines[lineNumber - 1].trim().startsWith('**')) {
            projectLine = lines[lineNumber - 1];
            removeStart = lineNumber - 1;
        }

        // Remove card from current location
        const removeCount = projectLine ? 2 + cardBody.length : 1 + cardBody.length;
        lines.splice(removeStart, removeCount);

        // Map target section ID to section heading
        let targetHeading = '';
        let targetSubheading = '';

        if (targetSection === 'now') {
            targetHeading = '## Backlog';
            targetSubheading = '### Now';
        } else if (targetSection === 'nextTwoWeeks') {
            targetHeading = '## Backlog';
            targetSubheading = '### Next 2 Weeks';
        } else if (targetSection === 'thisMonth') {
            targetHeading = '## Backlog';
            targetSubheading = '### This Month';
        } else if (targetSection === 'thisQuarter') {
            targetHeading = '## This Quarter';
        } else if (targetSection === 'thisYear') {
            targetHeading = '## This Year';
        } else if (targetSection === 'parking') {
            targetHeading = '## Parking Lot';
        }

        // Find target section
        let insertIndex = -1;

        for (let j = 0; j < lines.length; j++) {
            const trimmed = lines[j].trim();

            // Look for main heading first
            if (trimmed === targetHeading || trimmed.startsWith(targetHeading)) {

                // If we need a subheading, keep looking
                if (targetSubheading) {
                    for (let k = j + 1; k < lines.length; k++) {
                        const subTrimmed = lines[k].trim();
                        if (subTrimmed === targetSubheading) {
                            insertIndex = k + 1;
                            // Skip blank lines
                            while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
                                insertIndex++;
                            }
                            break;
                        }
                        // Stop if we hit another ## heading
                        if (subTrimmed.startsWith('## ')) {
                            break;
                        }
                    }
                } else {
                    // No subheading needed, insert right after main heading
                    insertIndex = j + 1;
                    // Skip blank lines
                    while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
                        insertIndex++;
                    }
                }
                break;
            }
        }

        if (insertIndex === -1) {
            vscode.window.showErrorMessage(`Could not find target section: ${targetHeading}${targetSubheading ? ' / ' + targetSubheading : ''}`);
            return;
        }

        // Insert project header if needed
        if (projectLine) {
            lines.splice(insertIndex, 0, projectLine);
            insertIndex++;
        }

        // Insert card line
        lines.splice(insertIndex, 0, cardLine);
        insertIndex++;

        // Insert body lines
        cardBody.forEach(bodyLine => {
            lines.splice(insertIndex, 0, bodyLine);
            insertIndex++;
        });

        // Add blank line for spacing
        lines.splice(insertIndex, 0, '');

        // Write back to file
        fs.writeFileSync(currentFilePath, lines.join('\n'), 'utf8');

        // Refresh the board
        setTimeout(() => refreshBoard(), 100);
    } catch (error) {
        vscode.window.showErrorMessage(`Error moving card to backlog section: ${error}`);
        console.error('Error in handleMoveToBacklogSection:', error);
    }
}

function getWebviewContent(boardData: BoardData): string {
    // Read configuration settings
    const config = vscode.workspace.getConfiguration('md-taskboard');
    const defaultView = config.get<string>('defaultView', 'standard');
    const showDayBadges = config.get<boolean>('showDayBadges', true);
    const showMetadataBadges = config.get<boolean>('showMetadataBadges', true);
    const autoCollapseSwimlaneDays = config.get<boolean>('autoCollapseSwimlaneDays', false);

    const projectColors = generateProjectColors(boardData);
    const projectLinks = getProjectLinks();

    // Generate title from week info
    let pageTitle = 'md Taskboard';
    if (boardData.weekInfo) {
        const { week, year, startDate, endDate } = boardData.weekInfo;
        if (startDate && endDate) {
            // Format: "Week 52 (Dec 29 - Jan 3)"
            const start = formatShortDate(startDate);
            const end = formatShortDate(endDate);
            pageTitle = `Week ${week} (${start} - ${end})`;
        } else {
            pageTitle = `Week ${week}, ${year}`;
        }
    }

    // Extract unique projects for filters
    const uniqueProjects = new Set<string>();
    [...boardData.todo, ...boardData.done].forEach(card => {
        if (card.project) {
            uniqueProjects.add(card.project);
        }
    });

    // Sort days in typical week order (use availableDays from parser instead of extracting from cards)
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedDays = boardData.availableDays.sort((a, b) => {
        return dayOrder.indexOf(a) - dayOrder.indexOf(b);
    });

    const dayOptions = sortedDays
        .map(day => `<option value="${escapeHtml(day)}">${escapeHtml(day)}</option>`)
        .join('');

    const projectOptions = Array.from(uniqueProjects)
        .sort()
        .map(project => `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`)
        .join('');

    // Group cards by day for swimlane view
    const cardsByDay = new Map<string, { todo: Card[], inProgress: Card[], done: Card[] }>();
    sortedDays.forEach(day => {
        cardsByDay.set(day, { todo: [], inProgress: [], done: [] });
    });

    [...boardData.todo, ...boardData.inProgress, ...boardData.done].forEach(card => {
        if (card.day && cardsByDay.has(card.day)) {
            const dayGroup = cardsByDay.get(card.day)!;
            if (card.column === 'todo') {
                dayGroup.todo.push(card);
            } else if (card.column === 'in-progress') {
                dayGroup.inProgress.push(card);
            } else {
                dayGroup.done.push(card);
            }
        }
    });

    // Generate swimlane HTML
    const swimlaneHtml = sortedDays.map(day => {
        const dayGroup = cardsByDay.get(day)!;
        const todoCount = dayGroup.todo.length;
        const inProgressCount = dayGroup.inProgress.length;
        const doneCount = dayGroup.done.length;
        const totalCount = todoCount + inProgressCount + doneCount;

        return `
            <div class="day-row" data-day="${escapeHtml(day)}">
                <div class="day-row-header" onclick="toggleDayRow('${escapeHtml(day)}')">
                    <span class="day-row-title">${escapeHtml(day)} (${totalCount} tasks)</span>
                    <span class="day-row-toggle" id="toggle-${escapeHtml(day)}">▼</span>
                </div>
                <div class="day-row-content" id="content-${escapeHtml(day)}">
                    <div class="day-column">
                        <div class="day-column-header">Todo (${todoCount})</div>
                        <div class="day-card-list" id="swimlane-todo-${escapeHtml(day)}" data-column="todo" data-day="${escapeHtml(day)}">
                            ${dayGroup.todo.map(card => renderCard(card, projectColors, projectLinks)).join('')}
                        </div>
                    </div>
                    <div class="day-column">
                        <div class="day-column-header">In Progress (${inProgressCount})</div>
                        <div class="day-card-list" id="swimlane-in-progress-${escapeHtml(day)}" data-column="in-progress" data-day="${escapeHtml(day)}">
                            ${dayGroup.inProgress.map(card => renderCard(card, projectColors, projectLinks)).join('')}
                        </div>
                    </div>
                    <div class="day-column">
                        <div class="day-column-header">Done (${doneCount})</div>
                        <div class="day-card-list" id="swimlane-done-${escapeHtml(day)}" data-column="done" data-day="${escapeHtml(day)}">
                            ${dayGroup.done.map(card => renderCard(card, projectColors, projectLinks)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Group backlog cards by priority buckets
    const backlogBuckets = {
        now: boardData.backlog.filter(c => c.backlogType === 'backlog' && c.backlogSubsection === 'Now'),
        nextTwoWeeks: boardData.backlog.filter(c => c.backlogType === 'backlog' && c.backlogSubsection === 'Next 2 Weeks'),
        thisMonth: boardData.backlog.filter(c => c.backlogType === 'backlog' && c.backlogSubsection === 'This Month'),
        thisQuarter: boardData.backlog.filter(c => c.backlogType === 'quarter'),
        thisYear: boardData.backlog.filter(c => c.backlogType === 'year'),
        parking: boardData.backlog.filter(c => c.backlogType === 'parking')
    };

    const backlogHtml = `
        <div class="backlog-section" data-section="now">
            <div class="section-header">
                <span class="section-title">� Now (Immediate)</span>
                <span class="section-count">${backlogBuckets.now.length} tasks</span>
            </div>
            <div class="section-cards" id="backlog-now" data-column="backlog-now">
                ${backlogBuckets.now.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>
        <div class="backlog-section" data-section="nextTwoWeeks">
            <div class="section-header">
                <span class="section-title">� Next 2 Weeks</span>
                <span class="section-count">${backlogBuckets.nextTwoWeeks.length} tasks</span>
            </div>
            <div class="section-cards" id="backlog-nextTwoWeeks" data-column="backlog-nextTwoWeeks">
                ${backlogBuckets.nextTwoWeeks.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>
        <div class="backlog-section" data-section="thisMonth">
            <div class="section-header">
                <span class="section-title">� This Month</span>
                <span class="section-count">${backlogBuckets.thisMonth.length} tasks</span>
            </div>
            <div class="section-cards" id="backlog-thisMonth" data-column="backlog-thisMonth">
                ${backlogBuckets.thisMonth.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>
        <div class="backlog-section" data-section="thisQuarter">
            <div class="section-header">
                <span class="section-title">�️ This Quarter</span>
                <span class="section-count">${backlogBuckets.thisQuarter.length} tasks</span>
            </div>
            <div class="section-cards" id="backlog-thisQuarter" data-column="backlog-thisQuarter">
                ${backlogBuckets.thisQuarter.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>
        <div class="backlog-section" data-section="thisYear">
            <div class="section-header">
                <span class="section-title">� This Year</span>
                <span class="section-count">${backlogBuckets.thisYear.length} tasks</span>
            </div>
            <div class="section-cards" id="backlog-thisYear" data-column="backlog-thisYear">
                ${backlogBuckets.thisYear.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>
        <div class="backlog-section" data-section="parking">
            <div class="section-header">
                <span class="section-title">�️ Parking Lot</span>
                <span class="section-count">${backlogBuckets.parking.length} tasks</span>
            </div>
            <div class="section-cards" id="backlog-parking" data-column="backlog-parking">
                ${backlogBuckets.parking.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
        }

        .header {
            margin-bottom: 20px;
        }

        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }

        .quick-add {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }

        .quick-add input {
            flex: 1;
            padding: 8px 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 14px;
        }

        .quick-add button, .refresh-btn {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }

        .quick-add button:hover, .refresh-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .board {
            display: flex;
            gap: 20px;
            overflow-x: auto;
        }

        .column {
            flex: 1;
            min-width: 300px;
            background-color: var(--vscode-sideBar-background);
            border-radius: 8px;
            padding: 16px;
            transition: all 0.25s ease;
        }

        .column-header {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }

        .card-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-height: 100px;
        }

        .card {
            background-color: var(--vscode-editor-background);
            border-radius: 8px;
            padding: 12px;
            cursor: move;
            border-left: 4px solid;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 8px;
            opacity: 0;
            transition: opacity 0.25s ease;
            pointer-events: none;
            box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        }

        .card:hover {
            transform: translateY(-3px) scale(1.01);
            box-shadow: 0 6px 12px rgba(0,0,0,0.12);
        }

        .card:hover::before {
            opacity: 1;
        }

        .card.dragging {
            opacity: 0.6;
            transform: rotate(2deg) scale(1.05);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .card-title {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
            line-height: 1.4;
        }

        .card-body {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            padding-left: 12px;
        }

        .card-body li {
            margin-bottom: 4px;
            line-height: 1.3;
        }

        /* Sub-task Progress Indicator */
        .subtask-progress {
            margin: 8px 0 12px 0;
            padding: 8px 10px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-widget-border);
        }

        .subtask-progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 12px;
        }

        .subtask-progress-label {
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
        }

        .subtask-progress-percentage {
            color: var(--vscode-charts-blue);
            font-weight: 600;
        }

        .subtask-progress-bar {
            height: 8px;
            background: rgba(128, 128, 128, 0.2);
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid rgba(128, 128, 128, 0.3);
        }

        .subtask-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4ECDC4 0%, #45B7D1 100%);
            transition: width 0.3s ease;
            box-shadow: 0 0 8px rgba(78, 205, 196, 0.4);
        }

        /* Different colors based on completion */
        .subtask-progress[data-percentage="100"] .subtask-progress-fill {
            background: linear-gradient(90deg, #52B788 0%, #4CAF50 100%);
            box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
        }

        /* Interactive Sub-task Checkboxes */
        .subtask-item {
            display: flex;
            align-items: center;
            margin-bottom: 6px;
            padding: 4px 0;
            cursor: pointer;
            transition: background-color 0.15s ease;
        }

        .subtask-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 3px;
        }

        .subtask-checkbox {
            margin-right: 8px;
            cursor: pointer;
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }

        .subtask-content {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
        }

        .subtask-text {
            color: var(--vscode-foreground);
            font-size: 13px;
            line-height: 1.4;
        }

        .subtask-checkbox-checked + .subtask-content .subtask-text {
            color: var(--vscode-descriptionForeground);
            text-decoration: line-through;
            opacity: 0.7;
        }

        /* Sub-task badges */
        .subtask-badges {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .subtask-badge {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            font-size: 10px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 10px;
            white-space: nowrap;
        }

        .subtask-badge.priority-high {
            background-color: rgba(255, 107, 107, 0.15);
            color: #ff6b6b;
        }

        .subtask-badge.priority-medium {
            background-color: rgba(255, 193, 7, 0.15);
            color: #ffc107;
        }

        .subtask-badge.priority-low {
            background-color: rgba(76, 175, 80, 0.15);
            color: #4caf50;
        }

        .subtask-badge.due-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .subtask-badge.due-overdue {
            background-color: rgba(255, 107, 107, 0.15);
            color: #ff6b6b;
        }

        .subtask-badge.due-today {
            background-color: rgba(255, 193, 7, 0.15);
            color: #ffc107;
        }

        .subtask-badge.due-soon {
            background-color: rgba(78, 205, 196, 0.15);
            color: #4ECDC4;
        }

        .subtask-badge.time-badge {
            background-color: rgba(69, 183, 209, 0.15);
            color: #45B7D1;
        }

        .card-project {
            font-size: 12px;
            font-weight: 600;
            opacity: 0.8;
        }

        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }

        a:hover {
            color: var(--vscode-textLink-activeForeground);
            text-decoration: underline;
        }

        .checkbox {
            font-size: 14px;
            margin-right: 6px;
            user-select: none;
        }

        .checkbox.unchecked {
            opacity: 0.7;
        }

        .checkbox.checked {
            color: var(--vscode-terminal-ansiGreen);
            font-weight: bold;
        }

        .drag-over {
            background-color: var(--vscode-list-hoverBackground);
            transform: scale(1.02);
            transition: all 0.2s ease;
            box-shadow: inset 0 0 0 2px var(--vscode-focusBorder);
        }

        .filter-bar {
            display: flex;
            gap: 16px;
            align-items: center;
            padding: 12px;
            background-color: var(--vscode-sideBar-background);
            border-radius: 6px;
            margin-bottom: 16px;
        }

        .filter-bar label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }

        .filter-bar select {
            padding: 6px 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .filter-bar select:hover {
            border-color: var(--vscode-focusBorder);
            background-color: var(--vscode-input-background);
            transform: translateY(-1px);
        }

        .filter-bar select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }

        .day-badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 600;
            padding: 3px 10px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 12px;
            margin-bottom: 6px;
            text-transform: uppercase;
            transition: all 0.2s ease;
        }

        .day-badge:hover {
            transform: scale(1.05);
            filter: brightness(1.1);
        }

        /* Hide badges based on configuration */
        body.hide-day-badges .day-badge {
            display: none;
        }

        body.hide-metadata-badges .metadata-badges {
            display: none;
        }

        /* Metadata badges */
        .metadata-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
        }

        .metadata-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 12px;
            white-space: nowrap;
            transition: all 0.2s ease;
            cursor: help;
        }

        .metadata-badge:hover {
            transform: translateY(-1px);
            filter: brightness(1.1);
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }

        .priority-badge {
            text-transform: uppercase;
        }

        .priority-high {
            background-color: rgba(255, 107, 107, 0.2);
            color: #ff6b6b;
            border: 1px solid #ff6b6b;
        }

        .priority-medium {
            background-color: rgba(255, 193, 7, 0.2);
            color: #ffc107;
            border: 1px solid #ffc107;
        }

        .priority-low {
            background-color: rgba(76, 175, 80, 0.2);
            color: #4caf50;
            border: 1px solid #4caf50;
        }

        .due-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border: 1px solid var(--vscode-badge-background);
        }

        .due-overdue {
            background-color: rgba(244, 67, 54, 0.2);
            color: #f44336;
            border: 1px solid #f44336;
            font-weight: 700;
        }

        .due-today {
            background-color: rgba(255, 152, 0, 0.2);
            color: #ff9800;
            border: 1px solid #ff9800;
        }

        .due-soon {
            background-color: rgba(255, 235, 59, 0.2);
            color: #c9a900;
            border: 1px solid #c9a900;
        }

        .time-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border: 1px solid var(--vscode-badge-background);
        }

        .card.has-overdue {
            border-left-width: 6px;
            box-shadow: 0 0 0 1px rgba(244, 67, 54, 0.3);
        }

        /* Swimlane View Styles */
        .swimlane-board {
            display: none;
        }

        .swimlane-board.active {
            display: block;
        }

        .backlog-board {
            display: none;
        }

        .backlog-board.active {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .board.active {
            display: flex;
        }

        .board:not(.active) {
            display: none;
        }

        /* Backlog grooming mode styles */
        .backlog-section {
            background-color: var(--vscode-sideBar-background);
            border-radius: 8px;
            padding: 16px;
            border: 1px solid var(--vscode-panel-border);
        }

        .backlog-section .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }

        .backlog-section .section-title {
            font-size: 16px;
            font-weight: 600;
        }

        .backlog-section .section-count {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
        }

        .backlog-section .section-cards {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-height: 50px;
        }

        .day-row {
            background-color: var(--vscode-sideBar-background);
            border-radius: 8px;
            margin-bottom: 16px;
            overflow: hidden;
        }

        .day-row-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background-color: var(--vscode-sideBarSectionHeader-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            user-select: none;
        }

        .day-row-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .day-row-title {
            font-size: 16px;
            font-weight: 600;
        }

        .day-row-toggle {
            font-size: 18px;
            transition: transform 0.2s;
        }

        .day-row-toggle.collapsed {
            transform: rotate(-90deg);
        }

        .day-row-content {
            display: flex;
            gap: 16px;
            padding: 16px;
        }

        .day-row-content.collapsed {
            display: none;
        }

        .day-column {
            flex: 1;
            min-width: 250px;
        }

        .day-column-header {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--vscode-panel-border);
            opacity: 0.8;
        }

        .day-card-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-height: 50px;
        }

        /* Week Navigation */
        .week-navigation {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .week-nav-btn {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
        }

        .week-nav-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        #weekDisplay {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-foreground);
            min-width: 120px;
            text-align: center;
        }
    </style>
</head>
<body class="${!showDayBadges ? 'hide-day-badges' : ''} ${!showMetadataBadges ? 'hide-metadata-badges' : ''}">
    <div class="header">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h1>${pageTitle}</h1>
            <div style="display: flex; align-items: center; gap: 16px;">
                <div class="week-navigation">
                    <button class="week-nav-btn" onclick="navigateWeek(-1)" title="Previous Week">◀ Week</button>
                    <span id="weekDisplay">Week ${boardData.weekInfo ? boardData.weekInfo.week : '?'}, ${boardData.weekInfo ? boardData.weekInfo.year : '?'}</span>
                    <button class="week-nav-btn" onclick="navigateWeek(1)" title="Next Week">Week ▶</button>
                </div>
                <label style="font-size: 14px; display: flex; align-items: center; gap: 8px;">
                    View:
                    <select id="viewSelector" onchange="switchView(this.value)" style="padding: 6px 10px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px; cursor: pointer;">
                        <option value="standard">Standard</option>
                        <option value="swimlane">Swimlanes</option>
                        <option value="backlog">Backlog Grooming</option>
                    </select>
                </label>
            </div>
        </div>
        <div class="quick-add">
            <input type="text" id="quickAddInput" placeholder="Quick add new task..." />
            <button onclick="addCard()">Add</button>
            <button class="refresh-btn" onclick="refresh()">Sync</button>
        </div>
    </div>

    <div class="filter-bar">
        <label>
            Day:
            <select id="dayFilter" onchange="updateFilter('day', this.value)">
                <option value="all">All Days</option>
                ${dayOptions}
            </select>
        </label>

        <label>
            Project:
            <select id="projectFilter" onchange="updateFilter('project', this.value)">
                <option value="all">All Projects</option>
                ${projectOptions}
            </select>
        </label>

        <label>
            Sort:
            <select id="sortFilter" onchange="updateSort(this.value)">
                <option value="none">Default</option>
                <option value="day">By Day</option>
                <option value="project">By Project</option>
                <option value="priority">By Priority</option>
                <option value="dueDate">By Due Date</option>
                <option value="timeEstimate">By Time Estimate</option>
            </select>
        </label>
    </div>

    <div class="board active" id="standardBoard">
        <div class="column" data-column="todo">
            <div class="column-header">Todo (${boardData.todo.length})</div>
            <div class="card-list" id="todo">
                ${boardData.todo.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>

        <div class="column" data-column="in-progress">
            <div class="column-header">In Progress (${boardData.inProgress.length})</div>
            <div class="card-list" id="in-progress">
                ${boardData.inProgress.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>

        <div class="column" data-column="done">
            <div class="column-header">Done (${boardData.done.length})</div>
            <div class="card-list" id="done">
                ${boardData.done.map(card => renderCard(card, projectColors, projectLinks)).join('')}
            </div>
        </div>
    </div>

    <div class="swimlane-board" id="swimlaneBoard">
        ${swimlaneHtml}
    </div>

    <div class="backlog-board" id="backlogBoard">
        ${backlogHtml}
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Configuration settings from VS Code
        const config = {
            defaultView: '${defaultView}',
            showDayBadges: ${showDayBadges},
            showMetadataBadges: ${showMetadataBadges},
            autoCollapseSwimlaneDays: ${autoCollapseSwimlaneDays},
            availableDays: ${JSON.stringify(sortedDays)}
        };

        // Filter state
        let activeFilters = {
            day: 'all',
            project: 'all'
        };
        let activeSort = 'none';

        // View state
        let currentView = config.defaultView;

        // Load saved view preference (overrides default)
        const savedState = vscode.getState();
        if (savedState && savedState.view) {
            currentView = savedState.view;
        }

        // Set initial view
        document.getElementById('viewSelector').value = currentView;
        switchView(currentView);

        // Auto-collapse days if configured and in swimlane view
        if (currentView === 'swimlane' && config.autoCollapseSwimlaneDays) {
            document.querySelectorAll('.day-row').forEach(row => {
                const day = row.dataset.day;
                const content = document.getElementById('content-' + day);
                const toggle = document.getElementById('toggle-' + day);
                if (content && toggle) {
                    content.classList.add('collapsed');
                    toggle.classList.add('collapsed');
                    toggle.textContent = '▶';
                }
            });
        }

        // Quick add functionality
        document.getElementById('quickAddInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addCard();
            }
        });

        function addCard() {
            const input = document.getElementById('quickAddInput');
            const title = input.value.trim();
            if (title) {
                vscode.postMessage({
                    type: 'addCard',
                    title: title
                });
                input.value = '';
            }
        }

        function refresh() {
            vscode.postMessage({ type: 'refresh' });
        }

        // Week navigation
        function navigateWeek(direction) {
            vscode.postMessage({
                type: 'navigateWeek',
                direction: direction
            });
        }

        // Filter and sort functionality
        function updateFilter(filterType, value) {
            activeFilters[filterType] = value;
            applyFiltersAndSort();
        }

        function updateSort(sortValue) {
            activeSort = sortValue;
            applyFiltersAndSort();
        }

        function applyFiltersAndSort() {
            if (currentView === 'standard') {
                // Standard view: sort the main todo and done columns
                const todoColumn = document.getElementById('todo');
                const doneColumn = document.getElementById('done');

                // Apply filters to each column
                applyFiltersToColumn(todoColumn);
                applyFiltersToColumn(doneColumn);

                // Apply sorting
                if (activeSort !== 'none') {
                    sortColumn(todoColumn, activeSort);
                    sortColumn(doneColumn, activeSort);
                }
            } else if (currentView === 'swimlane') {
                // Swimlane view: sort each day's todo and done columns
                const dayCardLists = document.querySelectorAll('.day-card-list');

                dayCardLists.forEach(column => {
                    applyFiltersToColumn(column);
                    if (activeSort !== 'none') {
                        sortColumn(column, activeSort);
                    }
                });
            }

            // Update card counts
            updateCardCounts();
        }

        function applyFiltersToColumn(column) {
            const cards = column.querySelectorAll('.card');
            cards.forEach(card => {
                const cardDay = card.dataset.day;
                const cardProject = card.dataset.project;

                const dayMatch = activeFilters.day === 'all' || cardDay === activeFilters.day;
                const projectMatch = activeFilters.project === 'all' || cardProject === activeFilters.project;

                if (dayMatch && projectMatch) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function sortColumn(column, sortBy) {
            const cards = Array.from(column.querySelectorAll('.card'));

            console.log('Sorting ' + cards.length + ' cards by: ' + sortBy);

            cards.sort((a, b) => {
                if (sortBy === 'day') {
                    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    const dayA = dayOrder.indexOf(a.dataset.day);
                    const dayB = dayOrder.indexOf(b.dataset.day);
                    return dayA - dayB;
                } else if (sortBy === 'project') {
                    const projA = a.dataset.project || '';
                    const projB = b.dataset.project || '';
                    return projA.localeCompare(projB);
                } else if (sortBy === 'priority') {
                    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2, 'none': 3 };
                    const prioA = a.dataset.priority || 'none';
                    const prioB = b.dataset.priority || 'none';
                    const valueA = priorityOrder[prioA] !== undefined ? priorityOrder[prioA] : 3;
                    const valueB = priorityOrder[prioB] !== undefined ? priorityOrder[prioB] : 3;

                    // Debug logging for first few comparisons
                    if (cards.indexOf(a) < 3 || cards.indexOf(b) < 3) {
                        console.log('Priority compare: "' + prioA + '" (' + valueA + ') vs "' + prioB + '" (' + valueB + ')');
                    }

                    return valueA - valueB;
                } else if (sortBy === 'dueDate') {
                    const dateA = a.dataset.dueDate || '9999-99-99';
                    const dateB = b.dataset.dueDate || '9999-99-99';
                    return dateA.localeCompare(dateB);
                } else if (sortBy === 'timeEstimate') {
                    // Convert time estimates to minutes for comparison
                    const getMinutes = (estimate) => {
                        if (!estimate || estimate === '') return 999999;
                        // Match number followed by h or m
                        const match = estimate.match(/(\\d+(?:\\.\\d+)?)\\s*(h|m)/i);
                        if (!match) {
                            console.log('No match for estimate: "' + estimate + '"');
                            return 999999;
                        }
                        const value = parseFloat(match[1]);
                        const unit = match[2].toLowerCase();
                        const minutes = unit === 'h' ? value * 60 : value;
                        return minutes;
                    };
                    // Use getAttribute to ensure we get the actual string value
                    const estA = a.getAttribute('data-time-estimate') || '';
                    const estB = b.getAttribute('data-time-estimate') || '';
                    const timeA = getMinutes(estA);
                    const timeB = getMinutes(estB);

                    // Debug logging
                    if (cards.indexOf(a) < 3 || cards.indexOf(b) < 3) {
                        console.log('Time compare: "' + estA + '" (' + timeA + 'min) vs "' + estB + '" (' + timeB + 'min)');
                    }

                    return timeA - timeB;
                }
                return 0;
            });

            // Re-append cards in sorted order
            cards.forEach(card => column.appendChild(card));
        }

        function updateCardCounts() {
            if (currentView === 'standard') {
                const todoColumn = document.getElementById('todo');
                const doneColumn = document.getElementById('done');

                const visibleTodo = Array.from(todoColumn.querySelectorAll('.card'))
                    .filter(card => card.style.display !== 'none').length;
                const visibleDone = Array.from(doneColumn.querySelectorAll('.card'))
                    .filter(card => card.style.display !== 'none').length;

                // Update column headers
                document.querySelector('[data-column="todo"] .column-header').textContent =
                    \`Todo (\${visibleTodo})\`;
                document.querySelector('[data-column="done"] .column-header').textContent =
                    \`Done (\${visibleDone})\`;
            }
        }

        // View switching
        function switchView(view) {
            currentView = view;

            // Save preference
            vscode.setState({ view: view });

            const standardBoard = document.getElementById('standardBoard');
            const swimlaneBoard = document.getElementById('swimlaneBoard');
            const backlogBoard = document.getElementById('backlogBoard');

            // Remove active from all boards
            standardBoard.classList.remove('active');
            swimlaneBoard.classList.remove('active');
            backlogBoard.classList.remove('active');

            // Add active to selected board
            if (view === 'swimlane') {
                swimlaneBoard.classList.add('active');
            } else if (view === 'backlog') {
                backlogBoard.classList.add('active');
            } else {
                // Default to standard view
                standardBoard.classList.add('active');
            }

            // Re-initialize drag & drop
            initializeDragAndDrop();
        }

        // Toggle day row collapse/expand
        function toggleDayRow(day) {
            const content = document.getElementById(\`content-\${day}\`);
            const toggle = document.getElementById(\`toggle-\${day}\`);

            if (content && toggle) {
                // Check if currently collapsed (either by class or inline style)
                const isCollapsed = content.classList.contains('collapsed') ||
                                   content.style.display === 'none';

                if (isCollapsed) {
                    // Expand: remove class and clear inline style
                    content.classList.remove('collapsed');
                    content.style.display = '';
                    toggle.classList.remove('collapsed');
                    toggle.textContent = '▼';
                } else {
                    // Collapse: add class (don't use inline style for consistency)
                    content.classList.add('collapsed');
                    toggle.classList.add('collapsed');
                    toggle.textContent = '▶';
                }
            }
        }

        // Drag and drop functionality
        let draggedCard = null;
        let activeContextMenu = null;

        function initializeDragAndDrop() {
            // Get all cards and columns from all views (standard, swimlane, backlog)
            const cards = document.querySelectorAll('.card');
            const columns = document.querySelectorAll('.card-list, .day-card-list, .section-cards');

            console.log('initializeDragAndDrop called - found', cards.length, 'cards');

            cards.forEach(card => {
                // Remove old listeners by cloning (cheap way to remove all listeners)
                const newCard = card.cloneNode(true);
                card.parentNode.replaceChild(newCard, card);

                newCard.addEventListener('dragstart', handleDragStart);
                newCard.addEventListener('dragend', handleDragEnd);
                newCard.addEventListener('contextmenu', handleCardContextMenu);
                console.log('Attached listeners to card:', newCard.dataset.cardId);
            });

            console.log('Finished attaching listeners to', cards.length, 'cards');

            columns.forEach(column => {
                column.addEventListener('dragover', handleDragOver);
                column.addEventListener('drop', handleDrop);
                column.addEventListener('dragleave', handleDragLeave);
            });
        }

        // Initialize on page load
        console.log('Initial page load - calling initializeDragAndDrop');
        initializeDragAndDrop();

        // Sub-task checkbox click handler
        document.addEventListener('click', (e) => {
            const checkbox = e.target;
            if (checkbox.classList && checkbox.classList.contains('subtask-checkbox')) {
                e.stopPropagation();  // Prevent card click

                const lineNumber = parseInt(checkbox.dataset.lineNumber);
                const cardId = checkbox.closest('.subtask-item').dataset.cardId;
                const newChecked = checkbox.checked;

                // Send message to extension
                vscode.postMessage({
                    type: 'toggleSubTask',
                    cardId: cardId,
                    lineNumber: lineNumber,
                    checked: newChecked
                });
            }
        });

        function handleDragStart(e) {
            draggedCard = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        }

        function handleDragEnd(e) {
            this.classList.remove('dragging');

            // Remove drag-over class from all columns
            columns.forEach(column => {
                column.classList.remove('drag-over');
            });
        }

        // Helper function to create menu items
        function createMenuItem(text, onClick) {
            const item = document.createElement('div');
            item.textContent = text;
            item.style.padding = '6px 12px';
            item.style.cursor = 'pointer';
            item.style.color = 'var(--vscode-menu-foreground)';
            item.onmouseenter = () => item.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
            item.onmouseleave = () => item.style.backgroundColor = 'transparent';
            item.onclick = onClick;
            return item;
        }

        // Helper function to create separator
        function createMenuSeparator() {
            const separator = document.createElement('div');
            separator.style.height = '1px';
            separator.style.backgroundColor = 'var(--vscode-menu-border)';
            separator.style.margin = '4px 0';
            return separator;
        }

        function handleCardContextMenu(e) {
            console.log('Context menu handler called', e);
            e.preventDefault();
            const cardElement = this;
            const cardId = cardElement.dataset.cardId;
            console.log('Card element:', cardElement, 'Card ID:', cardId);
            const currentPriority = cardElement.dataset.priority;
            const currentProject = cardElement.dataset.project;
            const backlogType = cardElement.dataset.backlogType; // Declare at top of function

            // Get the column - works for both standard and swimlane views
            const cardList = cardElement.closest('.card-list') || cardElement.closest('.day-card-list');
            let cardColumn = 'todo'; // default fallback
            if (cardList) {
                // Swimlane view: .day-card-list has data-column attribute
                if (cardList.dataset.column) {
                    cardColumn = cardList.dataset.column;
                }
                // Standard view: .card-list has id, or check parent .column for data-column
                else if (cardList.id) {
                    cardColumn = cardList.id;
                } else {
                    const column = cardList.closest('.column');
                    cardColumn = (column && column.dataset.column) || 'todo';
                }
            }

            // Close any existing context menu
            if (activeContextMenu && document.body.contains(activeContextMenu)) {
                document.body.removeChild(activeContextMenu);
                activeContextMenu = null;
            }

            // Show custom context menu
            const contextMenu = document.createElement('div');
            contextMenu.className = 'context-menu';
            contextMenu.style.position = 'fixed';
            contextMenu.style.left = e.clientX + 'px';
            contextMenu.style.top = e.clientY + 'px';
            contextMenu.style.backgroundColor = 'var(--vscode-menu-background)';
            contextMenu.style.border = '1px solid var(--vscode-menu-border)';
            contextMenu.style.borderRadius = '4px';
            contextMenu.style.padding = '4px 0';
            contextMenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            contextMenu.style.zIndex = '10000';
            contextMenu.style.minWidth = '200px';

            const closeContextMenu = () => {
                if (document.body.contains(contextMenu)) {
                    document.body.removeChild(contextMenu);
                }
                activeContextMenu = null;
            };

            // Open in Markdown
            contextMenu.appendChild(createMenuItem('Open in Markdown', () => {
                vscode.postMessage({
                    type: 'openInMarkdown',
                    cardId: cardId
                });
                closeContextMenu();
            }));

            contextMenu.appendChild(createMenuSeparator());

            // Edit Title
            contextMenu.appendChild(createMenuItem('Edit Title...', () => {
                vscode.postMessage({
                    type: 'promptCardTitle',
                    cardId: cardId,
                    currentTitle: cardElement.querySelector('.card-title')?.textContent || ''
                });
                closeContextMenu();
            }));

            // Edit Due Date
            contextMenu.appendChild(createMenuItem('Edit Due Date...', () => {
                vscode.postMessage({
                    type: 'promptCardDueDate',
                    cardId: cardId,
                    currentDueDate: cardElement.dataset.dueDate || ''
                });
                closeContextMenu();
            }));

            // Edit Time Estimate
            contextMenu.appendChild(createMenuItem('Edit Time Estimate...', () => {
                vscode.postMessage({
                    type: 'promptCardTimeEstimate',
                    cardId: cardId,
                    currentEstimate: cardElement.dataset.timeEstimate || ''
                });
                closeContextMenu();
            }));

            // Edit Description
            contextMenu.appendChild(createMenuItem('Edit Description...', () => {
                vscode.postMessage({
                    type: 'promptCardBody',
                    cardId: cardId,
                    currentBody: cardElement.dataset.body || '[]'
                });
                closeContextMenu();
            }));

            contextMenu.appendChild(createMenuSeparator());

            // Set Priority submenu
            const priorityItem = createMenuItem('Set Priority ›', null);
            priorityItem.style.position = 'relative';

            const prioritySubmenu = document.createElement('div');
            prioritySubmenu.className = 'context-submenu';
            prioritySubmenu.style.display = 'none';
            prioritySubmenu.style.position = 'fixed';
            prioritySubmenu.style.backgroundColor = 'var(--vscode-menu-background)';
            prioritySubmenu.style.border = '1px solid var(--vscode-menu-border)';
            prioritySubmenu.style.borderRadius = '4px';
            prioritySubmenu.style.padding = '4px 0';
            prioritySubmenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            prioritySubmenu.style.zIndex = '10001';
            prioritySubmenu.style.minWidth = '150px';

            ['High', 'Medium', 'Low', 'None'].forEach(priority => {
                const priorityOption = createMenuItem(
                    priority + (currentPriority === priority.toLowerCase() ? ' ✓' : ''),
                    () => {
                        vscode.postMessage({
                            type: 'editCardPriority',
                            cardId: cardId,
                            priority: priority === 'None' ? null : priority.toLowerCase()
                        });
                        closeContextMenu();
                    }
                );
                prioritySubmenu.appendChild(priorityOption);
            });

            priorityItem.onmouseenter = () => {
                priorityItem.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
                const rect = priorityItem.getBoundingClientRect();
                prioritySubmenu.style.left = (rect.right + 2) + 'px';
                prioritySubmenu.style.top = rect.top + 'px';
                prioritySubmenu.style.display = 'block';
            };
            priorityItem.onmouseleave = (e) => {
                if (!prioritySubmenu.contains(e.relatedTarget)) {
                    priorityItem.style.backgroundColor = 'transparent';
                    prioritySubmenu.style.display = 'none';
                }
            };
            prioritySubmenu.onmouseleave = (e) => {
                if (!priorityItem.contains(e.relatedTarget)) {
                    prioritySubmenu.style.display = 'none';
                    priorityItem.style.backgroundColor = 'transparent';
                }
            };

            contextMenu.appendChild(priorityItem);
            document.body.appendChild(prioritySubmenu);

            // Change Project
            contextMenu.appendChild(createMenuItem('Change Project...', () => {
                vscode.postMessage({
                    type: 'promptCardProject',
                    cardId: cardId,
                    currentProject: currentProject,
                    currentDay: cardElement.dataset.day
                });
                closeContextMenu();
            }));

            // Change State submenu
            const stateItem = createMenuItem('Change State ›', null);
            stateItem.style.position = 'relative';

            const stateSubmenu = document.createElement('div');
            stateSubmenu.className = 'context-submenu';
            stateSubmenu.style.display = 'none';
            stateSubmenu.style.position = 'fixed';
            stateSubmenu.style.backgroundColor = 'var(--vscode-menu-background)';
            stateSubmenu.style.border = '1px solid var(--vscode-menu-border)';
            stateSubmenu.style.borderRadius = '4px';
            stateSubmenu.style.padding = '4px 0';
            stateSubmenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            stateSubmenu.style.zIndex = '10001';
            stateSubmenu.style.minWidth = '150px';

            const states = [
                { id: 'todo', label: 'Todo' },
                { id: 'in-progress', label: 'In Progress' },
                { id: 'done', label: 'Done' }
            ];

            states.forEach(state => {
                const stateOption = createMenuItem(
                    state.label + (cardColumn === state.id ? ' ✓' : ''),
                    () => {
                        if (cardColumn !== state.id) {
                            vscode.postMessage({
                                type: 'changeCardState',
                                cardId: cardId,
                                newState: state.id
                            });
                        }
                        closeContextMenu();
                    }
                );
                stateSubmenu.appendChild(stateOption);
            });

            stateItem.onmouseenter = () => {
                stateItem.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
                const rect = stateItem.getBoundingClientRect();
                stateSubmenu.style.left = (rect.right + 2) + 'px';
                stateSubmenu.style.top = rect.top + 'px';
                stateSubmenu.style.display = 'block';
            };
            stateItem.onmouseleave = (e) => {
                if (!stateSubmenu.contains(e.relatedTarget)) {
                    stateItem.style.backgroundColor = 'transparent';
                    stateSubmenu.style.display = 'none';
                }
            };
            stateSubmenu.onmouseleave = (e) => {
                if (!stateItem.contains(e.relatedTarget)) {
                    stateSubmenu.style.display = 'none';
                    stateItem.style.backgroundColor = 'transparent';
                }
            };

            contextMenu.appendChild(stateItem);
            document.body.appendChild(stateSubmenu);

            // Move to Day submenu
            const moveToDayItem = createMenuItem('Move to Day ›', null);
            moveToDayItem.style.position = 'relative';

            const daySubmenu = document.createElement('div');
            daySubmenu.className = 'context-submenu';
            daySubmenu.style.display = 'none';
            daySubmenu.style.position = 'fixed';
            daySubmenu.style.backgroundColor = 'var(--vscode-menu-background)';
            daySubmenu.style.border = '1px solid var(--vscode-menu-border)';
            daySubmenu.style.borderRadius = '4px';
            daySubmenu.style.padding = '4px 0';
            daySubmenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            daySubmenu.style.zIndex = '10001';
            daySubmenu.style.minWidth = '150px';

            // Get available days from config
            const availableDays = config.availableDays || [];
            // For backlog cards, don't show any day as checked
            const currentDay = backlogType ? null : cardElement.dataset.day;

            availableDays.forEach(day => {
                const dayOption = createMenuItem(
                    day + (currentDay === day ? ' ✓' : ''),
                    () => {
                        if (currentDay !== day) {
                            vscode.postMessage({
                                type: 'moveCardToDay',
                                cardId: cardId,
                                targetDay: day,
                                cardProject: currentProject
                            });
                        }
                        closeContextMenu();
                    }
                );
                daySubmenu.appendChild(dayOption);
            });

            moveToDayItem.onmouseenter = () => {
                moveToDayItem.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
                const rect = moveToDayItem.getBoundingClientRect();
                daySubmenu.style.left = (rect.right + 2) + 'px';
                daySubmenu.style.top = rect.top + 'px';
                daySubmenu.style.display = 'block';
            };
            moveToDayItem.onmouseleave = (e) => {
                if (!daySubmenu.contains(e.relatedTarget)) {
                    moveToDayItem.style.backgroundColor = 'transparent';
                    daySubmenu.style.display = 'none';
                }
            };
            daySubmenu.onmouseleave = (e) => {
                if (!moveToDayItem.contains(e.relatedTarget)) {
                    daySubmenu.style.display = 'none';
                    moveToDayItem.style.backgroundColor = 'transparent';
                }
            };

            contextMenu.appendChild(moveToDayItem);
            document.body.appendChild(daySubmenu);

            // Backlog-specific options (only for backlog cards)
            let backlogSubmenu = null; // Declare at function scope for closeMenu

            if (backlogType) {
                contextMenu.appendChild(createMenuSeparator());

                // Move to Backlog Section submenu
                const moveToBacklogItem = createMenuItem('Move to Backlog ›', null);
                moveToBacklogItem.style.position = 'relative';

                backlogSubmenu = document.createElement('div');
                backlogSubmenu.className = 'context-submenu';
                backlogSubmenu.style.display = 'none';
                backlogSubmenu.style.position = 'fixed';
                backlogSubmenu.style.backgroundColor = 'var(--vscode-menu-background)';
                backlogSubmenu.style.border = '1px solid var(--vscode-menu-border)';
                backlogSubmenu.style.borderRadius = '4px';
                backlogSubmenu.style.padding = '4px 0';
                backlogSubmenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                backlogSubmenu.style.zIndex = '10001';
                backlogSubmenu.style.minWidth = '180px';

                const backlogSections = [
                    { id: 'now', label: '� Now (Immediate)' },
                    { id: 'nextTwoWeeks', label: '⏰ Next 2 Weeks' },
                    { id: 'thisMonth', label: '� This Month' },
                    { id: 'thisQuarter', label: '� This Quarter' },
                    { id: 'thisYear', label: '�️ This Year' },
                    { id: 'parking', label: '�️ Parking Lot' }
                ];

                const currentBacklogSection = cardElement.dataset.backlogSubsection;

                backlogSections.forEach(section => {
                    const sectionOption = createMenuItem(
                        section.label,
                        () => {
                            vscode.postMessage({
                                type: 'moveToBacklogSection',
                                cardId: cardId,
                                targetSection: section.id
                            });
                            closeContextMenu();
                        }
                    );
                    backlogSubmenu.appendChild(sectionOption);
                });

                moveToBacklogItem.onmouseenter = () => {
                    const rect = moveToBacklogItem.getBoundingClientRect();
                    backlogSubmenu.style.left = (rect.right + 2) + 'px';
                    backlogSubmenu.style.top = rect.top + 'px';
                    backlogSubmenu.style.display = 'block';
                    moveToBacklogItem.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
                };

                moveToBacklogItem.onmouseleave = (e) => {
                    if (!backlogSubmenu.contains(e.relatedTarget)) {
                        backlogSubmenu.style.display = 'none';
                        moveToBacklogItem.style.backgroundColor = 'transparent';
                    }
                };

                backlogSubmenu.onmouseleave = (e) => {
                    if (!moveToBacklogItem.contains(e.relatedTarget)) {
                        backlogSubmenu.style.display = 'none';
                        moveToBacklogItem.style.backgroundColor = 'transparent';
                    }
                };

                contextMenu.appendChild(moveToBacklogItem);
                document.body.appendChild(backlogSubmenu);

                contextMenu.appendChild(createMenuSeparator());

                // Move to Next Week
                contextMenu.appendChild(createMenuItem('Move to Next Week', () => {
                    vscode.postMessage({
                        type: 'moveToNextWeek',
                        cardId: cardId
                    });
                    closeContextMenu();
                }));

                // Move to Week...
                contextMenu.appendChild(createMenuItem('Move to Week...', () => {
                    vscode.postMessage({
                        type: 'promptMoveToWeek',
                        cardId: cardId
                    });
                    closeContextMenu();
                }));
            }

            contextMenu.appendChild(createMenuSeparator());

            // Delete Task
            const deleteItem = createMenuItem('Delete Task...', () => {
                vscode.postMessage({
                    type: 'deleteCard',
                    cardId: cardId
                });
                closeContextMenu();
            });
            deleteItem.style.color = 'var(--vscode-errorForeground)';
            contextMenu.appendChild(deleteItem);

            console.log('About to append context menu to body', contextMenu);
            document.body.appendChild(contextMenu);
            activeContextMenu = contextMenu;
            console.log('Context menu appended, activeContextMenu set');

            // Close menu on click outside
            const closeMenu = (e) => {
                // Check if click is in any submenu
                let clickedInSubmenu = false;
                try {
                    clickedInSubmenu = prioritySubmenu.contains(e.target) ||
                                      stateSubmenu.contains(e.target) ||
                                      daySubmenu.contains(e.target) ||
                                      (backlogSubmenu && backlogSubmenu.contains(e.target));
                } catch (err) {
                    console.error('Error checking submenu click:', err);
                }

                if (activeContextMenu && !activeContextMenu.contains(e.target) && !clickedInSubmenu) {
                    if (document.body.contains(activeContextMenu)) {
                        document.body.removeChild(activeContextMenu);
                    }
                    if (document.body.contains(prioritySubmenu)) {
                        document.body.removeChild(prioritySubmenu);
                    }
                    if (document.body.contains(stateSubmenu)) {
                        document.body.removeChild(stateSubmenu);
                    }
                    if (document.body.contains(daySubmenu)) {
                        document.body.removeChild(daySubmenu);
                    }
                    if (backlogSubmenu && document.body.contains(backlogSubmenu)) {
                        document.body.removeChild(backlogSubmenu);
                    }
                    activeContextMenu = null;
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        }

        function handleDragOver(e) {
            if (e.preventDefault) {
                e.preventDefault();
            }

            e.dataTransfer.dropEffect = 'move';
            this.classList.add('drag-over');

            return false;
        }

        function handleDragLeave(e) {
            this.classList.remove('drag-over');
        }

        function handleDrop(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }

            this.classList.remove('drag-over');

            if (draggedCard) {
                const cardId = draggedCard.dataset.cardId;
                const currentDay = draggedCard.dataset.day;
                const currentProject = draggedCard.dataset.project;

                // Extract column type and day from id
                // Standard view: "todo", "in-progress", or "done"
                // Swimlane view: "swimlane-todo-Monday", "swimlane-in-progress-Tuesday", or "swimlane-done-Wednesday"
                // Backlog view: "backlog-now", "backlog-nextTwoWeeks", etc.
                let toColumn = this.id;
                let toDay = null;

                // Handle backlog section drops
                if (toColumn.startsWith('backlog-')) {
                    const backlogSection = toColumn.replace('backlog-', '');
                    vscode.postMessage({
                        type: 'moveToBacklogSection',
                        cardId: cardId,
                        targetSection: backlogSection
                    });
                    return false;
                }

                if (toColumn.startsWith('swimlane-')) {
                    // Extract day and column from "swimlane-{column}-{day}"
                    // Handle multi-word columns like "in-progress"
                    const parts = toColumn.split('-');
                    parts.shift(); // Remove "swimlane"
                    toDay = parts.pop();   // Extract day name
                    toColumn = parts.join('-'); // Rejoin remaining parts (e.g., "in" + "progress" = "in-progress")
                }

                // Move to new column (state)
                vscode.postMessage({
                    type: 'moveCard',
                    cardId: cardId,
                    toColumn: toColumn
                });

                // If day changed in swimlane view, also move to new day
                if (toDay && currentDay !== toDay) {
                    vscode.postMessage({
                        type: 'moveCardToDay',
                        cardId: cardId,
                        targetDay: toDay,
                        cardProject: currentProject
                    });
                }
            }

            return false;
        }
    </script>
</body>
</html>`;
}

function parseDateInLocalTimezone(dateStr: string): Date {
    // Parse YYYY-MM-DD as local date, not UTC
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function getDueDateStatus(dueDate: string): 'overdue' | 'today' | 'soon' | 'future' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = parseDateInLocalTimezone(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return 'overdue';
    } else if (diffDays === 0) {
        return 'today';
    } else if (diffDays <= 3) {
        return 'soon';
    } else {
        return 'future';
    }
}

function formatDueDate(dueDate: string): string {
    const date = parseDateInLocalTimezone(dueDate);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
}

function renderCard(card: Card, projectColors: Map<string, string>, projectLinks: Map<string, string>): string {
    const color = card.project ? projectColors.get(card.project) || '#888888' : '#888888';

    // Build progress indicator if sub-tasks exist
    let progressHtml = '';
    if (card.subTaskProgress) {
        const { completed, total, percentage } = card.subTaskProgress;
        const progressBarWidth = percentage;

        progressHtml = `
            <div class="subtask-progress" data-percentage="${percentage}">
                <div class="subtask-progress-header">
                    <span class="subtask-progress-label">
                        ${completed}/${total} tasks
                    </span>
                    <span class="subtask-progress-percentage">${percentage}%</span>
                </div>
                <div class="subtask-progress-bar">
                    <div class="subtask-progress-fill" style="width: ${progressBarWidth}%"></div>
                </div>
            </div>
        `;
    }

    // Render body with interactive sub-task checkboxes
    const bodyHtml = card.body.length > 0
        ? `<ul class="card-body">${card.body.map((line, index) => {
            const subTask = card.subTasks?.find(st => st.bodyLineIndex === index);

            if (subTask) {
                // Render as interactive checkbox
                const checkboxClass = subTask.checked ? 'subtask-checkbox-checked' : 'subtask-checkbox-unchecked';

                // Build metadata badges for sub-task
                const subTaskBadges: string[] = [];

                if (subTask.priority) {
                    const priorityIcon = subTask.priority === 'high' ? '�' : subTask.priority === 'medium' ? '�' : '�';
                    subTaskBadges.push(`<span class="subtask-badge priority-badge priority-${subTask.priority}">${priorityIcon}</span>`);
                }

                if (subTask.dueDate) {
                    const status = getDueDateStatus(subTask.dueDate);
                    const formattedDate = formatDueDate(subTask.dueDate);
                    const dateIcon = status === 'overdue' ? '⚠️' : status === 'today' ? '�' : status === 'soon' ? '⏰' : '�';
                    subTaskBadges.push(`<span class="subtask-badge due-badge due-${status}">${dateIcon} ${formattedDate}</span>`);
                }

                if (subTask.timeEstimate) {
                    subTaskBadges.push(`<span class="subtask-badge time-badge">⏱️ ${escapeHtml(subTask.timeEstimate)}</span>`);
                }

                const badgesHtml = subTaskBadges.length > 0 ? `<span class="subtask-badges">${subTaskBadges.join('')}</span>` : '';

                return `
                    <li class="subtask-item"
                        data-card-id="${card.id}"
                        data-subtask-index="${index}"
                        data-line-number="${subTask.absoluteLineNumber}">
                        <input type="checkbox"
                               class="subtask-checkbox ${checkboxClass}"
                               ${subTask.checked ? 'checked' : ''}
                               data-line-number="${subTask.absoluteLineNumber}">
                        <span class="subtask-content">
                            <span class="subtask-text">${renderMarkdown(subTask.text)}</span>
                            ${badgesHtml}
                        </span>
                    </li>
                `;
            } else {
                // Regular body line (not a checkbox)
                return `<li>${renderMarkdown(line)}</li>`;
            }
        }).join('')}</ul>`
        : '';

    // Combine progress and body
    const fullBodyHtml = progressHtml + bodyHtml;

    // Render project with optional link
    let projectHtml = '';
    if (card.project) {
        const projectLink = projectLinks.get(card.project);
        if (projectLink) {
            projectHtml = `<div class="card-project"><a href="${escapeHtml(projectLink)}" target="_blank" rel="noopener noreferrer" title="Open project link">#${escapeHtml(card.project)}</a></div>`;
        } else {
            projectHtml = `<div class="card-project">#${escapeHtml(card.project)}</div>`;
        }
    }

    // Add day badge (show first 3 letters of day name)
    const dayBadge = card.day
        ? `<span class="day-badge">${escapeHtml(card.day.substring(0, 3))}</span>`
        : '';

    // Build metadata badges
    const metadataBadges: string[] = [];

    // Priority badge with icon
    if (card.priority) {
        const priorityIcon = card.priority === 'high' ? '�' : card.priority === 'medium' ? '�' : '�';
        const priorityLabel = card.priority === 'high' ? 'HIGH' : card.priority === 'medium' ? 'MED' : 'LOW';
        const priorityTooltip = card.priority === 'high' ? 'High Priority' : card.priority === 'medium' ? 'Medium Priority' : 'Low Priority';
        metadataBadges.push(`<span class="metadata-badge priority-badge priority-${card.priority}" title="${priorityTooltip}">${priorityIcon} ${priorityLabel}</span>`);
    }

    // Due date badge with icon
    if (card.dueDate) {
        const status = getDueDateStatus(card.dueDate);
        const formattedDate = formatDueDate(card.dueDate);
        const dateIcon = status === 'overdue' ? '⚠️' : status === 'today' ? '�' : status === 'soon' ? '⏰' : '�';
        const statusLabel = status === 'overdue' ? 'OVERDUE' : status === 'today' ? 'Today' : status === 'soon' ? 'Due Soon' : 'Upcoming';
        metadataBadges.push(`<span class="metadata-badge due-badge due-${status}" title="Due: ${formattedDate} (${statusLabel})">${dateIcon} ${formattedDate}</span>`);
    }

    // Time estimate badge with icon
    if (card.timeEstimate) {
        metadataBadges.push(`<span class="metadata-badge time-badge" title="Estimated time: ${escapeHtml(card.timeEstimate)}">⏱️ ${escapeHtml(card.timeEstimate)}</span>`);
    }

    const metadataHtml = metadataBadges.length > 0
        ? `<div class="metadata-badges">${metadataBadges.join('')}</div>`
        : '';

    // Determine if card is overdue
    const isOverdue = card.dueDate && getDueDateStatus(card.dueDate) === 'overdue';
    const cardClasses = isOverdue ? 'card has-overdue' : 'card';

    // Build comprehensive tooltip
    const tooltipParts: string[] = [card.title];
    if (card.project) {
        tooltipParts.push(`Project: #${card.project}`);
    }
    if (card.day) {
        tooltipParts.push(`Day: ${card.day}`);
    }
    if (card.priority) {
        const priorityLabel = card.priority === 'high' ? 'High Priority' : card.priority === 'medium' ? 'Medium Priority' : 'Low Priority';
        tooltipParts.push(priorityLabel);
    }
    if (card.dueDate) {
        const status = getDueDateStatus(card.dueDate);
        const statusLabel = status === 'overdue' ? 'OVERDUE' : status === 'today' ? 'Today' : status === 'soon' ? 'Due Soon' : 'Upcoming';
        tooltipParts.push(`Due: ${formatDueDate(card.dueDate)} (${statusLabel})`);
    }
    if (card.timeEstimate) {
        tooltipParts.push(`Est: ${card.timeEstimate}`);
    }
    const cardTooltip = tooltipParts.join('\n');

    // Add subtle gradient background based on project color
    const gradientStyle = `border-left-color: ${color}; background: linear-gradient(to right, ${color}08, transparent 50%);`;

    return `
        <div class="${cardClasses}"
             draggable="true"
             data-card-id="${card.id}"
             data-day="${escapeHtml(card.day || 'unknown')}"
             data-project="${escapeHtml(card.project || 'none')}"
             data-priority="${card.priority || 'none'}"
             data-due-date="${card.dueDate || ''}"
             data-time-estimate="${card.timeEstimate || ''}"
             data-body="${escapeHtml(JSON.stringify(card.body))}"
             ${card.backlogType ? `data-backlog-type="${card.backlogType}"` : ''}
             ${card.backlogSubsection ? `data-backlog-subsection="${escapeHtml(card.backlogSubsection)}"` : ''}
             title="${escapeHtml(cardTooltip)}"
             style="${gradientStyle}">
            ${dayBadge}
            <div class="card-title">${renderMarkdown(card.title)}</div>
            ${fullBodyHtml}
            ${metadataHtml}
            ${projectHtml}
        </div>
    `;
}

function generateProjectColors(boardData: BoardData): Map<string, string> {
    const defaultColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
    ];

    // Read configuration
    const config = vscode.workspace.getConfiguration('md-taskboard');
    const projectsConfig = config.get<Record<string, { color?: string, link?: string }>>('projects', {});

    const projects = new Set<string>();
    [...boardData.todo, ...boardData.done].forEach(card => {
        if (card.project) {
            projects.add(card.project);
        }
    });

    const projectColors = new Map<string, string>();
    Array.from(projects).forEach((project, index) => {
        // Use custom color if configured, otherwise use default color
        const customColor = projectsConfig[project]?.color;
        const color = customColor || defaultColors[index % defaultColors.length];
        projectColors.set(project, color);
    });

    return projectColors;
}

function getProjectLinks(): Map<string, string> {
    const config = vscode.workspace.getConfiguration('md-taskboard');
    const projectsConfig = config.get<Record<string, { color?: string, link?: string }>>('projects', {});

    const projectLinks = new Map<string, string>();
    Object.keys(projectsConfig).forEach(project => {
        const link = projectsConfig[project]?.link;
        if (link) {
            projectLinks.set(project, link);
        }
    });

    return projectLinks;
}

function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function renderMarkdown(text: string): string {
    // First escape HTML
    let result = escapeHtml(text);

    // Remove markdown list prefix "- " at the start (since we're already in <li>)
    // This prevents double-dash rendering (• and -)
    result = result.replace(/^- /, '');

    // Convert markdown checkboxes to visual checkboxes
    // [ ] becomes ☐ (unchecked box)
    // [x] becomes ☑ (checked box)
    result = result.replace(/\[ \]/g, '<span class="checkbox unchecked">☐</span>');
    result = result.replace(/\[x\]/g, '<span class="checkbox checked">☑</span>');

    // Convert markdown links [text](url) to HTML <a> tags
    // Match: [anything](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    // Convert bold **text** to <strong>
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    return result;
}

function formatShortDate(dateStr: string): string {
    // Input: "2025-12-29" or similar
    // Output: "Dec 29"
    try {
        const date = new Date(dateStr);
        const month = date.toLocaleString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day}`;
    } catch {
        return dateStr;
    }
}

export function deactivate() {
    if (documentChangeListener) {
        documentChangeListener.dispose();
    }
    if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
    }
}
