import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface VersionInfo {
  name: string;
  version: string | null;
  installed: boolean;
  error?: string;
}

async function checkFFmpegVersion(): Promise<VersionInfo> {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    const versionMatch = stdout.match(/ffmpeg version (\S+)/);
    const version = versionMatch ? versionMatch[1] : null;
    
    return {
      name: 'ffmpeg',
      version,
      installed: true,
    };
  } catch (error) {
    return {
      name: 'ffmpeg',
      version: null,
      installed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkSceneDetectVersion(): Promise<VersionInfo> {
  try {
    const { stdout } = await execAsync('scenedetect version');
    const versionMatch = stdout.match(/PySceneDetect\s+(\S+)/);
    const version = versionMatch ? versionMatch[1] : null;
    
    return {
      name: 'scenedetect',
      version,
      installed: true,
    };
  } catch (error) {
    return {
      name: 'scenedetect',
      version: null,
      installed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const [ffmpegInfo, scenedetectInfo] = await Promise.all([
      checkFFmpegVersion(),
      checkSceneDetectVersion(),
    ]);

    return NextResponse.json({
      ffmpeg: ffmpegInfo,
      scenedetect: scenedetectInfo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check system versions' },
      { status: 500 }
    );
  }
}