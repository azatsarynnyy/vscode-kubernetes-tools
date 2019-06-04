import * as vscode from 'vscode';
import { shell, Shell, ShellResult } from '../shell';
import { getImageBuildTool } from '../components/config/config';
import { IKubeChannel, kubeChannel } from '../kubeChannel';

/**
 * A contract for container image build tool.
 * Provides the commands for basic operations on the images (build/push)
 * and knows how to check whether the tool is available.
 */
abstract class ImageService {

    /** Display name. */
    protected name: string;

    /** Name of the binary. */
    protected binName: string;

    /**
     * d
     * @param name display name
     * @param binName binary name
     * @param shell shell
     * @param channel channel
     */
    constructor(protected name: string, protected binName: string, protected shell: Shell, protected channel: IKubeChannel) {}

    /** Returns a command line to build the given image. */
    getBuildCommand(image: string): string {
        return `${this.binName} build -t ${image} .`;
    }

    /** Returns a command line to publish the given image to a registry. */
    getPushCommand(image: string): string {
        return `${this.binName} push ${image}`;
    }

    /** Builds the given image. */
    async build(image: string, shellOpts: any): Promise<ShellResult> {
        const result = await this.callCommand(getBuildCommand(image), shellOpts, image + ' built.', `Image build failed`);
        if (result && result.code === 0) {
            kubeChannel.showOutput(image + ' built.', this.name);
        } else if (!result) {
            vscode.window.showErrorMessage(`Image build failed; unable to call ${this.binName}.`);
        } else {
            kubeChannel.showOutput(result.stderr, this.name);
            vscode.window.showErrorMessage('Image build failed. See Output window for details.');
        }
        // TODO: do we really need to return a result?
        return result;
    }

    /** Publishes the given image. */
    async publish(image: string, shellOpts: any): Promise<ShellResult> {
        const result = await this.callCommand(getPushCommand(image), shellOpts, image + ' built.', `Image push failed`);
        if (result && result.code === 0) {
            kubeChannel.showOutput(image + ' built.', this.name);
        } else if (!result) {
            vscode.window.showErrorMessage(`Image push failed; unable to call ${this.binName}.`);
        } else {
            const diagnostic = diagnosePushError(result.code, result.stderr);
            kubeChannel.showOutput(result.stderr, this.name);
            vscode.window.showErrorMessage(`${diagnostic} See Output window for ${this.name} push error message.`);
        }
        // TODO: do we really need to return a result?
        return result;
    }

    async callCommand(cmd: string, shellOpts: any, successMsg: string, errMsg: string): Promise<ShellResult> {
        const result = await this.shell.execCore(cmd, shellOpts);
        if (result.code !== 0) {
            throw new Error(`${errMsg}: ${result.stderr}`);
        }
        this.channel.showOutput(successMsg);
        return result;
    }

    /** Tests whether this tool is installed and properly configured. */
    // verify?
    async available(): Promise<boolean> {
        const result = await shell.exec(`${this.binName} version`);
        return result !== undefined && result.code === 0;
    }
}

class Docker extends ImageService {
    async available(): Promise<boolean> {
        const result = await shell.exec(`${this.binName} version --format "{{.Server.APIVersion}}"`);
        return result !== undefined && result.code === 0;
    }
}

class Buildah extends ImageService {
    getBuildCommand(image: string): string {
        return `${this.binName} bud -t ${image} .`;
    }
}

export const supportedTools: { [id: string]: ImageService } = {
    docker: new Docker('Docker', 'docker', shell, kubeChannel),
    buildah: new Buildah('Buildah', 'buildah', shell, kubeChannel)
};

/** Returns a command line for building the specified image with a current build tool. */
export function getBuildCommand(image: string): string {
    const buildTool = supportedTools[getImageBuildTool()];
    return buildTool.getBuildCommand(image);
}

/** Returns a command line for pushing the specified image with a current build tool. */
export function getPushCommand(image: string): string {
    const buildTool = supportedTools[getImageBuildTool()];
    return buildTool.getPushCommand(image);
}
