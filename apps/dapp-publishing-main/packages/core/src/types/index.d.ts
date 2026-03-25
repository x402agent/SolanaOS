declare module "image-size" {
  export function imageSize(
    path: string,
    cb: (error: Error, dimensions: { width: number; height: number }) => void
  );
}

declare module "get-video-dimensions" {
  export default function getVideoDimensions(
    path: string
  ): Promise<{ width?: number; height?: number }>;
}
