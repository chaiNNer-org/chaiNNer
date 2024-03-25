from .. import image_category

io_group = image_category.add_node_group("Input & Output")
batch_processing_group = image_category.add_node_group("Batch Processing")
video_frames_group = image_category.add_node_group("Video Frames")
create_images_group = image_category.add_node_group("Create Images")

batch_processing_group.order = [
    "chainner:image:load_images",
    "chainner:image:load_image_pairs",
    "chainner:image:split_spritesheet",
    "chainner:image:merge_spritesheet",
]
