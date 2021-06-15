/*global chrome*/
import React, { useRef } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import styled from 'styled-components';
import Toolbox from './components/Toolbox/Toolbox';

const CanvasBorder = styled.div`
  border: solid 3px limegreen;
`;

const CanvasMain = styled.div`
  position: absolute;
  top: 0px;
  right: 0px;
  left: 0px;
  z-index: 2147483647;
  background:none transparent;
`;

const Canvas = () => {

  const [tool, setTool] = React.useState('pen');
  const [lines, setLines] = React.useState([]);
  const [height, setHeight] = React.useState(window.innerHeight + window.scrollY);
  const heightRef = useRef({});
  heightRef.current = height;

  const isDrawing = React.useRef(false);

  let originalFixedElements = new Set();
  let canvas = document.createElement('canvas');
  let originalOverflowStyle;

  React.useEffect(() => { 
    window.addEventListener('scroll', calculateHeight);
    const cleanup = () => {
      window.removeEventListener('scroll', calculateHeight);
    }
    return cleanup;
  });

  const handleMouseDown = (e) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { tool, points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e) => {
    // no drawing - skipping
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let newLine = lines;
    let size = lines.length - 1;
    let lastLine = lines[size];
    // add point
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    newLine[size] = lastLine;
    setLines(newLine.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const calculateHeight = () => {
    let newHeight = window.innerHeight + window.scrollY;
    // use heightRef instead of height inside window eventlistener of useEffect : https://stackoverflow.com/questions/56511176/state-being-reset
    if (newHeight > heightRef.current && heightRef.current < 32000) { // MAX canvas length in chrome and firefox os around 32767 pixels
      setHeight(newHeight);
    }
  };

  const handleCapture = () => {
    let app = document.getElementById('blackboard-canvas-1234');
    let top = app.getBoundingClientRect().top + window.pageYOffset;
    let height = app.getBoundingClientRect().height;
    _prepare();
    
    let n = (height / window.innerHeight);
    let screenshots = [];
    canvas.width = window.innerWidth;
    canvas.height = height;
    let context = canvas.getContext('2d');
    for (let i = 0; i<n; i++) {
      screenshots[i] = {
        scrollTo: top,
      };
      top = top + window.innerHeight;
    }

    capture(0,n, screenshots, context);
    
  };


  const capture = (j,n,screenshots,context) => {
    let isComplete = (j-n <= 1 && j-n >= 0) ? true : false;
    if (!isComplete) window.scrollTo({top: screenshots[j].scrollTo});
    window.setTimeout(() => {
      if(!isComplete) {
        chrome.runtime.sendMessage({message: 'capture_screenshot'}, (captured) => {
          let dY = window.scrollY;
          _getAllFixedElements();
          let image = new Image();
          image.onload = () => {
            context.drawImage(image, 0, dY, window.innerWidth, window.innerHeight);
          };
          image.src = captured;
          let k = j + 1;
          capture(k,n,screenshots,context);
        });
				
      } else {
        chrome.runtime.sendMessage({message: 'save', image: canvas.toDataURL('image/png')}, () => {
          _cleanup();
        });
      }	
    }, 400);
  };

  const _cleanup = () => {
    for(let item of originalFixedElements) { 
      item.element.style.position = item.style;
    }
    let toolbox = document.getElementById('blackboard-canvas-1234-toolbox');
    toolbox.style.display = 'flex';
    let app = document.getElementById('blackboard-canvas-1234');
    app.style.border = 'solid 3px limegreen';
    document.body.style.overflow = originalOverflowStyle;
  };
  
  const _getAllFixedElements = () => {
    let elems = document.body.getElementsByTagName('*');
    let length = elems.length;
    for(let i = 0; i < length; i++) { 
      let elemStyle = window.getComputedStyle(elems[i]);
      if(elemStyle.getPropertyValue('position') === 'fixed' || elemStyle.getPropertyValue('position') === 'sticky' ) { 
          const originalStyle = elemStyle.getPropertyValue('position');
          elems[i].style.position = 'absolute';
          originalFixedElements.add({style: originalStyle, element: elems[i]});
      } 
    }
  };

  const _prepare = () => {
    let toolbox = document.getElementById('blackboard-canvas-1234-toolbox');
    let app = document.getElementById('blackboard-canvas-1234');
    toolbox.style.display = 'none';
    app.style.border = 'none';
    originalOverflowStyle = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  return (
    <CanvasMain>
      <CanvasBorder id="blackboard-canvas-1234">
        <Stage
          width={window.innerWidth}
          height={height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke="#df4b26"
                strokeWidth={2}
                tension={0.5}
                lineCap="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
        <Toolbox
          handleSetTool={(tool) => {
            setTool(tool);
          }}
          handleCapture={handleCapture}
        ></Toolbox>
      </CanvasBorder>
    </CanvasMain>
  );
};

export default Canvas;
