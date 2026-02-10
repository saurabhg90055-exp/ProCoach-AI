from PIL import Image
import os

# Paths
source_image_path = r"C:\Users\Saurabh\.gemini\antigravity\brain\68a402af-091b-4ac1-a791-1656335c2e40\media__1770709980916.png"
output_dir = r"c:/Users/Saurabh/ai-interviewer/frontend/public/assets"

def process_images():
    if not os.path.exists(source_image_path):
        print(f"Error: Source image not found at {source_image_path}")
        return

    try:
        img = Image.open(source_image_path)
        width, height = img.size
        
        # Assuming the image contains two portraits side-by-side or top-bottom.
        # Based on typical user uploads for this context, let's assume side-by-side first, 
        # but if height > width, maybe top-bottom. 
        # Actually, let's just split it simply in half vertically for now as a best guess 
        # since I can't see the image.
        # If it's a single image with both, usually they are side by side.
        
        # Split width-wise
        male_img = img.crop((0, 0, width // 2, height))
        female_img = img.crop((width // 2, 0, width, height))
        
        # Save images
        male_output = os.path.join(output_dir, "interviewer_male.png")
        female_output = os.path.join(output_dir, "interviewer_female.png")
        
        male_img.save(male_output)
        female_img.save(female_output)
        
        print(f"Successfully saved images to {output_dir}")
        print(f"Male: {male_output}")
        print(f"Female: {female_output}")
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    process_images()
