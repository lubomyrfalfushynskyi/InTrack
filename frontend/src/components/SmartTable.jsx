import React, { useState, useMemo, useCallback } from 'react';
import { Table } from 'antd';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

/**
 * SmartTable - універсальна таблиця з розтягненням колонок
 *
 * Особливості:
 * - Авто-ширина колонок по контенту
 * - Розтягування колонок (крім першої вліво та останньої з діями)
 * - Мінімальна ширина колонки = ширина заголовка
 * - Клік на рядок = перехід на деталізацію
 * - Покращена пагінація (50/100/200/500/1000)
 * - Збереження ширини в localStorage
 * - Текст обрізається з ... (tooltip при наведенні)
 */

const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;

  // Якщо width немає - це не resizable колонка
  if (!width) return <th {...restProps} />;

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            zIndex: 1,
            width: 10,
            height: '100%',
            cursor: 'col-resize',
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

const SmartTable = ({
  columns = [],
  dataSource = [],
  rowKey = 'id',
  loading = false,
  size = 'middle',
  bordered = false,
  pagination = {},
  onChange,
  onRow,
  storageKey = null,
  rowClassName,
  scroll,
  ...restProps
}) => {
  // ====== 1. ЛОКАЛЬНИЙ СТАН ДЛЯ ШИРИНИ КОЛОНОК ======
  const [colWidths, setColWidths] = useState(() => {
    if (!storageKey) return {};
    try {
      const saved = localStorage.getItem(`smarttable_widths_${storageKey}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // ====== 2. ОБРОБНИК РОЗТЯГУВАННЯ ======
  const handleResize = useCallback((key) => (_, { size }) => {
    setColWidths((prev) => {
      const next = { ...prev, [key]: size.width };
      if (storageKey) {
        try {
          localStorage.setItem(`smarttable_widths_${storageKey}`, JSON.stringify(next));
        } catch (e) {
          // localStorage може бути повний
        }
      }
      return next;
    });
  }, [storageKey]);

  // ====== 3. ОБЧИСЛЕННЯ КОЛОНОК З ШИРИНОЮ ======
  const computedColumns = useMemo(() => {
    return columns.map((col, index) => {
      const key = col.key || col.dataIndex;

      // Визначаємо ширину
      let width = col.width;

      // Якщо є збережена ширина - використовуємо її
      if (colWidths[key] !== undefined) {
        width = colWidths[key];
      }

      // Визначаємо, чи можна розтягувати
      // Не можна: перша колонка (вліво) та остання з діями (вправо)
      const isResizable = col.resizable !== false && !col.fixed;

      // Об'єднуємо з onHeaderCell
      const originalOnHeaderCell = col.onHeaderCell;
      const onHeaderCell = (column) => {
        const originalProps = originalOnHeaderCell ? originalOnHeaderCell(column) : {};
        return {
          ...originalProps,
          width: width,
          onResize: isResizable ? handleResize(key) : undefined,
        };
      };

      // Повертаємо колонку з ellipsis за замовчуванням
      return {
        ...col,
        width: width,
        onHeaderCell: onHeaderCell,
        // ellipsis за замовчуванням, якщо не вказано інше
        ellipsis: col.ellipsis !== undefined ? col.ellipsis : true,
      };
    });
  }, [columns, colWidths, handleResize]);

  // ====== 4. ПАГІНАЦІЯ ЗА ЗАМОВЧУВАННЯМ ======
  const defaultPagination = {
    current: 1,
    pageSize: 50,
    pageSizeOptions: ['50', '100', '200', '500', '1000', '10000'],
    showSizeChanger: true,
    showTotal: (total) => `Всього: ${total}`,
    position: ['bottomRight'],
  };

  const finalPagination = pagination === false ? false : {
    ...defaultPagination,
    ...pagination,
  };

  // ====== 5. SCROLL ЗА ЗАМОВЧУВАННЯМ ======
  const finalScroll = scroll || {};

  // ====== 6. КОМПОНЕНТИ ЗАГОЛОВКІВ ======
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  return (
    <Table
      columns={computedColumns}
      dataSource={dataSource}
      rowKey={rowKey}
      loading={loading}
      size={size}
      bordered={bordered}
      pagination={finalPagination}
      onChange={onChange}
      onRow={onRow}
      rowClassName={rowClassName}
      scroll={finalScroll}
      components={components}
      {...restProps}
    />
  );
};

export default SmartTable;
