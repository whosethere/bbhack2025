import cv2
import numpy as np
from ultralytics import YOLO
import os
from pathlib import Path

class PoseDetector:
    def __init__(self):
        """Initialize YOLO pose detection model"""
        try:
            # Download and load YOLOv8 pose model
            self.model = YOLO('yolov8n-pose.pt')
            print("YOLO pose model loaded successfully")
        except Exception as e:
            print(f"Error loading YOLO model: {e}")
            self.model = None

    def process_video(self, input_path: str, output_path: str) -> bool:
        """
        Process video file with pose detection

        Args:
            input_path: Path to original video file
            output_path: Path where processed video will be saved

        Returns:
            bool: True if processing successful, False otherwise
        """
        if not self.model:
            print("YOLO model not available")
            return False

        if not os.path.exists(input_path):
            print(f"Input video file not found: {input_path}")
            return False

        try:
            # Open video capture
            cap = cv2.VideoCapture(input_path)

            # Get video properties
            original_fps = int(cap.get(cv2.CAP_PROP_FPS))
            original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            # Set target resolution and fps (lower for processing efficiency)
            target_fps = min(25, original_fps)  # Max 25 FPS
            target_width = min(640, original_width)  # Max 640px width
            target_height = int((target_width / original_width) * original_height)  # Keep aspect ratio

            # Setup video writer with MP4 format
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            # Change output extension to .mp4
            output_path_mp4 = output_path.replace('.webm', '.mp4')
            out = cv2.VideoWriter(output_path_mp4, fourcc, target_fps, (target_width, target_height))

            print(f"Processing video: {input_path}")
            print(f"Original: {original_width}x{original_height}, {original_fps} FPS")
            print(f"Target: {target_width}x{target_height}, {target_fps} FPS")

            frame_count = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # Resize frame to target resolution
                if original_width != target_width or original_height != target_height:
                    frame = cv2.resize(frame, (target_width, target_height))

                # Run pose detection
                results = self.model(frame, verbose=False)

                # Draw pose on frame
                annotated_frame = self.draw_pose(frame, results)

                # Write frame
                out.write(annotated_frame)
                frame_count += 1

                if frame_count % 30 == 0:  # Progress update every 30 frames
                    print(f"Processed {frame_count} frames...")

            # Cleanup
            cap.release()
            out.release()

            print(f"Video processing completed: {output_path_mp4}")
            print(f"Total frames processed: {frame_count}")

            # Update the output_path to return the correct MP4 path
            return output_path_mp4

        except Exception as e:
            print(f"Error processing video: {e}")
            return None

    def draw_pose(self, frame, results):
        """
        Draw pose detection on frame
        Focus on upper body points suitable for webcam recordings
        """
        annotated_frame = frame.copy()

        # Upper body keypoint indices for YOLO pose
        upper_body_keypoints = {
            0: 'nose',
            1: 'left_eye', 2: 'right_eye',
            3: 'left_ear', 4: 'right_ear',
            5: 'left_shoulder', 6: 'right_shoulder',
            7: 'left_elbow', 8: 'right_elbow',
            9: 'left_wrist', 10: 'right_wrist'
        }

        # Focus keypoints (hands) for coordinate display
        focus_points = {9: 'L_wrist', 10: 'R_wrist'}

        # Skeleton connections for upper body
        connections = [
            (1, 3), (1, 0), (0, 2), (2, 4),  # Head
            (5, 6),  # Shoulders
            (5, 7), (7, 9),  # Left arm
            (6, 8), (8, 10)  # Right arm
        ]

        if results and len(results) > 0:
            for result in results:
                if result.keypoints is not None:
                    keypoints = result.keypoints.xy[0].cpu().numpy()  # Get first person

                    # Draw skeleton connections
                    for start_idx, end_idx in connections:
                        if start_idx < len(keypoints) and end_idx < len(keypoints):
                            start_point = keypoints[start_idx]
                            end_point = keypoints[end_idx]

                            # Check if both points are detected (not [0,0])
                            if (start_point[0] > 0 and start_point[1] > 0 and
                                end_point[0] > 0 and end_point[1] > 0):

                                cv2.line(annotated_frame,
                                        (int(start_point[0]), int(start_point[1])),
                                        (int(end_point[0]), int(end_point[1])),
                                        (0, 255, 0), 2)

                    # Draw keypoints
                    for idx, point in enumerate(keypoints):
                        if idx in upper_body_keypoints and point[0] > 0 and point[1] > 0:
                            x, y = int(point[0]), int(point[1])

                            # Different colors for different body parts
                            if idx in [9, 10]:  # Wrists (hands) - red
                                color = (0, 0, 255)
                                radius = 8
                            elif idx in [7, 8]:  # Elbows - blue
                                color = (255, 0, 0)
                                radius = 6
                            elif idx in [5, 6]:  # Shoulders - green
                                color = (0, 255, 0)
                                radius = 6
                            else:  # Head points - yellow
                                color = (0, 255, 255)
                                radius = 4

                            cv2.circle(annotated_frame, (x, y), radius, color, -1)

                            # Show coordinates for focus points (wrists)
                            if idx in focus_points:
                                label = f"{focus_points[idx]}: ({x},{y})"
                                cv2.putText(annotated_frame, label,
                                          (x + 15, y - 10),
                                          cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                                          (255, 255, 255), 2)
                                cv2.putText(annotated_frame, label,
                                          (x + 15, y - 10),
                                          cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                                          color, 1)

        return annotated_frame

def process_interview_video(input_path: str) -> str:
    """
    Process interview video with pose detection

    Args:
        input_path: Path to original video

    Returns:
        str: Path to processed video file
    """
    # Generate output filename (will be converted to MP4)
    input_file = Path(input_path)
    output_path = str(input_file.parent / f"{input_file.stem}_przetworzone{input_file.suffix}")

    # Initialize pose detector
    detector = PoseDetector()

    # Process video - returns actual path or None
    processed_path = detector.process_video(input_path, output_path)

    return processed_path  # Returns the actual MP4 path or None

if __name__ == "__main__":
    # Test the pose detector
    test_video = "test_video.mp4"  # Replace with actual test video
    if os.path.exists(test_video):
        result = process_interview_video(test_video)
        if result:
            print(f"Successfully processed: {result}")
        else:
            print("Processing failed")
    else:
        print("Test video not found")