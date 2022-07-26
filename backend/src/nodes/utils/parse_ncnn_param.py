import json

with open("./ncnn_param_schema_converted.json") as f:
    param_schema = json.load(f)

print(f"{param_schema['Convolution']=}")


def parse_ncnn_param(param_path):
    with open(param_path, "r", encoding="utf-8") as infile:
        magic = int(infile.readline().rstrip())
        print(f"{magic=}")
        layer_count, blob_count = [int(x) for x in infile.readline().rstrip().split()]
        print(f"{layer_count=} {blob_count=}")
        for _ in range(2):
            line = infile.readline().rstrip()
            layer_type, layer_name, input_count, output_count = line.split()[0:4]
            input_count = int(input_count)
            output_count = int(output_count)
            i = 4
            input_blobs = line.split()[i : i + input_count]
            i += input_count
            try:
                output_blobs = line.split()[i : i + output_count]
            except IndexError:
                output_blobs = []
            i += output_count
            try:
                layer_specific_params = line.split()[i:]
                layer_specific_params_temp = {}
                for layer_param in layer_specific_params:
                    layer_param_key, layer_param_value = layer_param.split("=")
                    layer_param_key = int(layer_param_key)
                    if layer_param_key >= 0:
                        if "." in layer_param_value:
                            layer_param_value = float(layer_param_value)
                        else:
                            layer_param_value = int(layer_param_value)
                    else:
                        layer_param_key = (layer_param_key * -1) - 23300
                        layer_param_value = [
                            float(x) if "." in x else int(x)
                            for x in layer_param_value.split(",")
                        ]
                    layer_specific_params_temp[
                        param_schema[layer_type][str(layer_param_key)]["paramPhase"]
                    ] = layer_param_value

                layer_specific_params = layer_specific_params_temp
            except IndexError:
                layer_specific_params = []

            print(
                f"{layer_type=} {layer_name=} {input_count=} {output_count=} {input_blobs=} {output_blobs=} {layer_specific_params=}"
            )


parse_ncnn_param(r"D:/Upscaling/models/LoD/New folder/4x_BSRGAN-opt.param")
