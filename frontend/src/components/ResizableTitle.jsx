import React from 'react';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

// Заголовок колонки з ресайзером для AntD Table
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width || 100}
      height={0}
      handle={
        <span className="react-resizable-handle" onClick={(e) => e.stopPropagation()} />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

export default ResizableTitle;
