// Getting Image from the input box 


        const input = document.getElementById("uploadInput");
        input.addEventListener("change", async (event) => {
            const boxes = await detect_objects_on_image(event.target.files[0]);
            draw_image_and_boxes(event.target.files[0], boxes);
        })



        // this function is used to draw bounding box on the image after detection 


        function draw_image_and_boxes(file, boxes) {
            const img = new Image();
            img.onload = () => {
                const offscreenCanvas = document.createElement('canvas');
                const offscreenCtx = offscreenCanvas.getContext('2d');
                offscreenCanvas.width = img.width;
                offscreenCanvas.height = img.height;
                offscreenCtx.drawImage(img, 0, 0);
                offscreenCtx.strokeStyle = "#00FF00";
                offscreenCtx.lineWidth = 3;
                offscreenCtx.font = "18px serif";
                boxes.forEach(([x1, y1, x2, y2, label]) => {
                    offscreenCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                    offscreenCtx.fillStyle = "#00ff00";
                    const width = offscreenCtx.measureText(label).width;
                    offscreenCtx.fillRect(x1, y1, width + 10, 25);
                    offscreenCtx.fillStyle = "#000000";
                    offscreenCtx.fillText(label, x1, y1 + 18);
                });

                const dataURL = offscreenCanvas.toDataURL('image/jpeg');
                const downloadLink = document.createElement('a');
                downloadLink.href = dataURL;
                downloadLink.download = 'image_with_boxes.jpg';

                downloadLink.click();
            };
            img.src = URL.createObjectURL(file);
        }

        // function is used to detect image


        async function detect_objects_on_image(buf) {
            const [input, img_width, img_height] = await prepare_input(buf);
            const output = await run_model(input);
            return process_output(output, img_width, img_height);
        }


        async function prepare_input(buf) {
            return new Promise(resolve => {
                const img = new Image();
                img.src = URL.createObjectURL(buf);
                img.onload = () => {
                    const [img_width, img_height] = [img.width, img.height]
                    const canvas = document.createElement("canvas");
                    canvas.width = 640;
                    canvas.height = 640;
                    const context = canvas.getContext("2d");
                    context.drawImage(img, 0, 0, 640, 640);
                    const imgData = context.getImageData(0, 0, 640, 640);
                    const pixels = imgData.data;
                    const red = [], green = [], blue = [];
                    for (let index = 0; index < pixels.length; index += 4) {
                        red.push(pixels[index] / 255.0);
                        green.push(pixels[index + 1] / 255.0);
                        blue.push(pixels[index + 2] / 255.0);
                    }
                    const input = [...red, ...green, ...blue];
                    resolve([input, img_width, img_height])
                }
            })
        }

        // this function loads the model and runs it. 


        async function run_model(input) {
            const model = await ort.InferenceSession.create("best_final.onnx");
            input = new ort.Tensor(Float32Array.from(input), [1, 3, 640, 640]);
            const outputs = await model.run({ images: input });
            console.log(outputs['output0'].data)
            return outputs["output0"].data;
        }

        // this function extract the bounding boxes 


        function process_output(output, img_width, img_height) {
            let boxes = [];
            for (let index = 0; index < 8400; index++) {
                const [class_id, prob] = [...Array(80).keys()]
                    .map(col => [col, output[8400 * (col + 4) + index]])
                    .reduce((accum, item) => item[1] > accum[1] ? item : accum, [0, 0]);
                if (prob < 0.5) {
                    continue;
                }
                const label = yolo_classes[class_id];
                const xc = output[index];
                const yc = output[8400 + index];
                const w = output[2 * 8400 + index];
                const h = output[3 * 8400 + index];
                const x1 = (xc - w / 2) / 640 * img_width;
                const y1 = (yc - h / 2) / 640 * img_height;
                const x2 = (xc + w / 2) / 640 * img_width;
                const y2 = (yc + h / 2) / 640 * img_height;
                boxes.push([x1, y1, x2, y2, label, prob]);
            }

            boxes = boxes.sort((box1, box2) => box2[5] - box1[5])
            const result = [];
            while (boxes.length > 0) {
                result.push(boxes[0]);
                boxes = boxes.filter(box => iou(boxes[0], box) < 0.7);
            }
            return result;
        }

        // this function calculate the intersection over union 

        function iou(box1, box2) {
            return intersection(box1, box2) / union(box1, box2);
        }
        // this function is calculate the union 
        function union(box1, box2) {
            const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
            const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
            const box1_area = (box1_x2 - box1_x1) * (box1_y2 - box1_y1)
            const box2_area = (box2_x2 - box2_x1) * (box2_y2 - box2_y1)
            return box1_area + box2_area - intersection(box1, box2)
        }
        // this is used to calculate the intersection 
        function intersection(box1, box2) {
            const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
            const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
            const x1 = Math.max(box1_x1, box2_x1);
            const y1 = Math.max(box1_y1, box2_y1);
            const x2 = Math.min(box1_x2, box2_x2);
            const y2 = Math.min(box1_y2, box2_y2);
            return (x2 - x1) * (y2 - y1)
        }

        // this is pothole class 


        const yolo_classes = [
            'Pothole'
        ];