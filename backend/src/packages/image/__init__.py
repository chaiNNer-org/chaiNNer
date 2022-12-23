from api import add_package

package = add_package(__file__, name="Image p", dependencies=[])

image = package.add_category("Image", "Image nodes")

io = image.add_sub_category("Input & Output")
