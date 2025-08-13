import fs from 'node:fs';
import path from 'node:path';

import * as vscode from 'vscode';
import * as crypto from 'node:crypto';

const STATE_KEY = 'ibeloyar-todo-tasks';

interface TodoTask {
	id: string;
	text: string;
	done: boolean;
}

interface TaskAction {
	action: 'add_task' | 'toggle_task' | 'delete_task' | 'clear_state';
	id: string;
	text: string;
	done: boolean;
}

type IconName = 'addIcon' | 'editIcon' | 'deleteIcon' | 'clearIcon';

export class MyWebviewViewProvider implements vscode.WebviewViewProvider {
	private ctx: vscode.ExtensionContext;
	private tasks: TodoTask[] = [];
	private badge: vscode.ViewBadge = { value: 0, tooltip: '' };
	// private metaCSPContent: string = '';

	private currentColorThemeIsDark: boolean = false; 
	private icons: Record<IconName,string> = {
		addIcon: '',
		editIcon: '',
		clearIcon: '',
		deleteIcon: '',
	};

    constructor(private readonly context: vscode.ExtensionContext, initTasks: TodoTask[], colorTheme: vscode.ColorThemeKind) {
		const restTask = initTasks.reduce((acc, i) => i.done ? acc : acc + 1, 0);

		this.ctx = context;
		this.tasks = initTasks;
		this.badge = {
			value: restTask,
			tooltip: `Rest ${restTask} task`
		};

		if (colorTheme === vscode.ColorThemeKind.Dark) {
			this.currentColorThemeIsDark = true;
		}
	}

	async changeState(webviewView: vscode.WebviewView, newState: TodoTask[]) {
		const restTask = newState.reduce((acc, i) => i.done ? acc : acc + 1, 0);

		this.tasks = newState;
		this.badge = {
			value: restTask,
			tooltip: `Rest ${restTask} task`
		};

		await this.ctx.globalState.update(STATE_KEY, newState);
				
		webviewView.badge = this.badge;

		webviewView.webview.postMessage({ 
			command: "refresh_list", 
			tasks: this.tasks, 
			icons: this.icons, 
			currentColorThemeIsDark: this.currentColorThemeIsDark,
			// metaCSPContent: this.metaCSPContent,
		});
	}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = {
            enableScripts: true,
			// localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'src', 'static')]
        };

		// this.metaCSPContent = `default-src 'none'; img-src ${webviewView.webview.cspSource} https:; script-src ${webviewView.webview.cspSource}; style-src ${webviewView.webview.cspSource};`

		this.icons = {
			addIcon: `${webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, 'public', 'icons', 'add.png'))}`,
			editIcon: `${webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, 'public', 'icons', 'edit.png'))}`,
			deleteIcon: `${webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, 'public', 'icons', 'delete.png'))}`,
			clearIcon: `${webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, 'public', 'icons', 'clear.png'))}`,
		};

		const htmlPath = path.join(this.context.extensionPath, 'public', 'extention.html');
        const htmlContent = fs.readFileSync(htmlPath, { encoding: 'utf-8' });

        webviewView.webview.html = htmlContent;

		this.changeState(webviewView, this.tasks);

        webviewView.webview.onDidReceiveMessage(async (data: TaskAction) => {
			if (data.action === 'add_task') {
				const newState = [...this.tasks, { 
					id: crypto.randomUUID(),
					text: data.text, 
					done: false,
				}]; 

				this.changeState(webviewView, newState);
            }

			if (data.action === 'toggle_task') {
				const newState = this.tasks.map((task) => task.id === data.id ? ({...task, done: !task.done }) : task);

				this.changeState(webviewView, newState);
            }

			if (data.action === 'delete_task') {
				const newState = this.tasks.filter((task) => task.id !== data.id);

				this.changeState(webviewView, newState);
            }

			if (data.action === 'clear_state') {
				this.changeState(webviewView, []);
            }
        });
  	}
}

export async function activate(context: vscode.ExtensionContext) {
	const state = context.globalState.get<TodoTask[]>(STATE_KEY);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'FirNotes',
			new MyWebviewViewProvider(context, state || [], vscode.window.activeColorTheme.kind),
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				}
			}
		)
	);
}

export function deactivate() {
	console.log('deactivate');
}
