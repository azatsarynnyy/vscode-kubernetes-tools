import * as vscode from 'vscode';

import { kubeChannel } from '../kubeChannel';
import { getImageBuildTool, setImageBuildTool } from '../components/config/config';
import { supportedTools } from './buildToolsRegistry';

/**
 * Proposes to use Buildah as an alternative image build tool
 * if some problems with Docker have been detected.
 */
export async function detect(): Promise<void> {
    const currentTool = getImageBuildTool();
    if (currentTool === 'docker') {
        const docker = supportedTools['docker'];
        const buildah = supportedTools['buildah'];
        if (!await docker.available() && await buildah.available()) {
            const answer = await vscode.window.showInformationMessage("Docker isn't installed or it's not configured. Do you want to use Buildah as an image build tool?", 'Use Buildah');
            if (answer === 'Use Buildah') {
                setImageBuildTool('buildah');
                kubeChannel.showOutput(`Buildah has been set as a container image build tool. It can be changed in 'vs-kubernetes.imageBuildTool' setting later.`);
            }
        }
    }
}
