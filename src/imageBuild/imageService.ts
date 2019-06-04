import * as vscode from 'vscode';
import * as path from 'path';
import * as docker from '../docker';
import { kubeChannel } from '../kubeChannel';
import { shell, Shell, ShellResult } from '../shell';

export interface ImageService {

    build(cwd: string, shellOpts?: any): Promise<string>;

    push(cwd: string, shellOpts?: any): Promise<void>;
}

/**
 * Service offers basic image operations.
 */
class ImageServiceImpl implements ImageService {

    async build(cwd: string, p: vscode.Progress<{}>, shellOpts?: any): Promise<string> {
        const image = await getDefaultImageName(cwd);
        const opts = Object.assign({}, shell.execOpts(), shellOpts);
        // await buildInternal(image, shellOpts || opts);
        const result = await shell.execCore(getBuildCommand(image), opts);
        if (result && result.code === 0) {
            kubeChannel.showOutput(image + ' built.', this.name);
        } else if (!result) {
            vscode.window.showErrorMessage(`Image build failed; unable to call ${this.binName}.`);
        } else {
            kubeChannel.showOutput(result.stderr, this.name);
            vscode.window.showErrorMessage('Image build failed. See Output window for details.');
        }
        return image;
    }

    async push(cwd: string, shellOpts?: any): Promise<void> {
        const image = await getDefaultImageName(cwd);
        const opts = Object.assign({}, shell.execOpts(), shellOpts);
        return pushInternal(image, opts);
    }
}

async function getDefaultImageName(workspaceFolderPath?: string): Promise<string> {
    const cwd = workspaceFolderPath || vscode.workspace.rootPath;
    if (!cwd) {
        throw new Error('This command requires an opened folder.');
    }
    const name = docker.sanitiseTag(path.basename(cwd));
    const version = await findVersion(cwd);
    let image = `${name}:${version}`;
    const imagePrefix = vscode.workspace.getConfiguration().get('vsdocker.imageUser', null);
    if (imagePrefix) {
        image = `${imagePrefix}/${image}`;
    }
    return image;
}

async function buildInternal(image: string, shellOpts: any): Promise<void> {
    const result = await shell.execCore(getBuildCommand(image), shellOpts);
    if (result && result.code === 0) {
        kubeChannel.showOutput(image + ' built.', this.name);
    } else if (!result) {
        vscode.window.showErrorMessage(`Image build failed; unable to call ${this.binName}.`);
    } else {
        kubeChannel.showOutput(result.stderr, this.name);
        vscode.window.showErrorMessage('Image build failed. See Output window for details.');
    }
}

async function pushInternal(image: string, shellOpts: any): Promise<void> {

}

async function findVersion(cwd: string): Promise<string> {
    const shellOpts = Object.assign({ }, shell.execOpts(), { cwd });
    const shellResult = await shell.execCore('git describe --always --dirty', shellOpts);
    return shellResult.code === 0 ? shellResult.stdout.trim() : 'latest';
}

const serviceImpl = new ImageServiceImpl();

export function get(): ImageService {
    return serviceImpl;
}
