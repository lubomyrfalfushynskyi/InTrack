import React, { useEffect, useState } from 'react';
import { Table, Card, Space, Button, Typography, Modal, Form, Input, InputNumber, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { assetTypesAPI } from '../services/api';
import InfoButton from '../components/InfoButton';

const { Title, Text } = Typography;

const AssetTypesPage = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [current, setCurrent] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = async () => { setLoading(true); try { const r = await assetTypesAPI.getAll(); setTypes(r.data); } catch (e) { message.error('Помилка'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setMode('create'); setCurrent(null); form.resetFields(); setOpen(true); };
  const openEdit = (t) => { setMode('edit'); setCurrent(t); form.setFieldsValue(t); setOpen(true); };

  const submit = async (values) => {
    setSubmitting(true);
    try {
      if (mode === 'create') await assetTypesAPI.create(values);
      else await assetTypesAPI.update(current.type_id, values);
      message.success('Збережено'); setOpen(false); load();
    } catch (e) { message.error(e.response?.data?.message || 'Помилка'); } finally { setSubmitting(false); }
  };
  const remove = async (t) => { try { await assetTypesAPI.remove(t.type_id); message.success('Видалено'); load(); } catch (e) { message.error(e.response?.data?.message || 'Помилка'); } };

  const columns = [
    { title: 'Найменування', dataIndex: 'name', key: 'name' },
    { title: 'Опис', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Норматив (років)', dataIndex: 'normative_life_years', key: 'normative_life_years', width: 130 },
    { title: 'Норматив напрацювання (год)', dataIndex: 'normative_hours', key: 'normative_hours', width: 200, render: (v) => v ? Number(v).toLocaleString('uk-UA') : '—' },
    { title: '', key: 'act', width: 90, render: (_, r) => (<Space>
      <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
      <Popconfirm title="Видалити вид?" onConfirm={() => remove(r)} okText="Так" cancelText="Ні"><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
    </Space>) },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><Title level={2} style={{ margin: 0 }}>Види майна</Title><Text type="secondary">Каталог нормативних строків служби</Text></div>
          <Space>
            <InfoButton title="Види майна" items={[
              { title: 'Каталог', text: 'кожен вид задає нормативний строк у роках і нормативне напрацювання у годинах. Строк вичерпується, коли досягнуто будь-якого з порогів.' },
              { title: 'Продовження', text: 'продовжує лише рік (+1); норматив годин не зростає.' },
              { title: 'Хто веде', text: 'каталог веде глобальний адмін.' },
            ]} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Додати вид</Button>
          </Space>
        </div>
        <Card><Space><Button icon={<ReloadOutlined />} onClick={load}>Оновити</Button></Space></Card>
        <Card><Table columns={columns} dataSource={types} rowKey="type_id" loading={loading} size="middle" /></Card>
      </Space>
      <Modal title={mode === 'create' ? 'Новий вид майна' : 'Редагувати вид'} open={open} onCancel={() => setOpen(false)} footer={null} width={520}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label="Найменування" name="name" rules={[{ required: true, message: 'Введіть назву' }]}><Input /></Form.Item>
          <Form.Item label="Опис" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="Нормативний строк служби (років)" name="normative_life_years" rules={[{ required: true, message: 'Введіть строк' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Норматив напрацювання (годин, необов'язково)" name="normative_hours"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => setOpen(false)}>Скасувати</Button><Button type="primary" htmlType="submit" loading={submitting}>Зберегти</Button></Space></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetTypesPage;
