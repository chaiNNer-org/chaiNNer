import struct

import numpy as np

FLAG_FLOAT_32 = 0x0
FLAG_FLOAT_16 = 0x01306B47


def parse_ncnn_param(param_path):
    with open(param_path, "r", encoding="utf-8") as infile:
        magic = int(infile.readline().rstrip())
        print(f"{magic=}")
        layer_count, blob_count = [int(x) for x in infile.readline().rstrip().split()]
        print(f"{layer_count=} {blob_count=}")
        for _ in range(layer_count):
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
                layer_specific_params_temp = []
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
                    layer_specific_params_temp.append(
                        (layer_param_key, layer_param_value)
                    )
                layer_specific_params = layer_specific_params_temp
            except IndexError:
                layer_specific_params = []

            print(
                f"{layer_type=} {layer_name=} {input_count=} {output_count=} {input_blobs=} {output_blobs=} {layer_specific_params=}"
            )


def parse_ncnn_bin_from_file(bin_path: str):
    def get_flag(bin_file: str):
        with open(bin_file, mode="rb") as file:
            flag = file.read(4)
            flag = struct.unpack("<I", flag)[0]
            return flag

    def get_weights(bin_file: str):
        flag = get_flag(bin_file)
        if flag == FLAG_FLOAT_32:
            dt = np.float32
        elif flag == FLAG_FLOAT_16:
            dt = np.float16
        else:
            dt = np.int8
        weights = np.fromfile(bin_file, dtype=dt, offset=4)
        return weights

    return get_weights(bin_path)


def parse_ncnn_bin_from_buffer(bin_buf: bytes):
    def get_flag(bin_file: bytes) -> int:
        flag = bin_file[:4]
        flag = struct.unpack("<I", flag)[0]
        return flag

    def get_weights(bin_file: bytes) -> np.ndarray:
        flag = get_flag(bin_file)
        if flag == FLAG_FLOAT_32:
            dt = np.float32
        elif flag == FLAG_FLOAT_16:
            dt = np.float16
        else:
            dt = np.int8
        weights = np.frombuffer(bin_file, dtype=dt, offset=4)
        return weights

    return get_weights(bin_buf)
