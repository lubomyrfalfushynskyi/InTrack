import React, { useState } from 'react';
import { Button, Modal, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Paragraph } = Typography;

// Інфо-кнопка з поясненням «що й як» для вкладки
const InfoButton = ({ title = 'Допомога', items = [] }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="text" icon={<QuestionCircleOutlined />} onClick={() => setOpen(true)}>Допомога</Button>
      <Modal title={title} open={open} onCancel={() => setOpen(false)} footer={null} width={560}>
        {items.map((it, i) => (
          <Paragraph key={i} style={{ marginBottom: 8 }}>
            {it.title ? <><strong>{it.title}</strong> — </> : null}{it.text}
          </Paragraph>
        ))}
      </Modal>
    </>
  );
};

export default InfoButton;
