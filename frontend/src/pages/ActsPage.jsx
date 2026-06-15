import React, { useEffect, useState, useCallback } from 'react';
import { Table, Card, Space, Button, Tag, Select, Typography, Modal, Form, Input, InputNumber, DatePicker, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { actsAPI, assetsAPI, assetTypesAPI, departmentsAPI, locationsAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import InfoButton from '../components/InfoButton';

const { Title, Text } = Typography;
const ACT_LABEL = { introduction: 'Введення', transfer: 'Передача', extension: 'Продовження', write_off: 'Списання' };
const ACT_COLOR = { introduction: 'green', transfer: 'blue', extension: 'gold', write_off: 'red' };

const ActsPage = () => {
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filterType, setFilterType] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [actType, setActType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [assets, setAssets] = useState([]);
  const [types, setTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const { user } = useAuthStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await actsAPI.getAll({ page: pagination.current, limit: pagination.pageSize, act_type: filterType });
      setActs(r.data.data);
      setPagination((p) => ({ ...p, total: r.data.pagination.total }));
    } catch (e) { message.error('Помилка завантаження'); } finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, filterType]);
  useEffect(() => { load(); }, [load]);

  const openModal = async () => {
    form.resetFields();
    form.setFieldsValue({ act_date: dayjs(), action_date: dayjs(), unit: 'шт.', quantity: 1 });
    setActType(null);
    setOpen(true);
    try {
      const [a, t, d, l] = await Promise.all([assetsAPI.getAll({ limit: 1000 }), assetTypesAPI.getAll(), departmentsAPI.getAll(), locationsAPI.getAll()]);
      setAssets(a.data.data); setTypes(t.data); setDepartments(d.data); setLocations(l.data);
    } catch (e) { /* scoped */ }
  };

  const submit = async (values) => {
    setSubmitting(true);
    try {
      const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
      const payload = {
        ...values,
        act_date: values.act_date.format('YYYY-MM-DD'),
        action_date: values.action_date ? values.action_date.format('YYYY-MM-DD') : undefined,
        asset_id: num(values.asset_id), to_department_id: num(values.to_department_id),
        asset_type_id: num(values.asset_type_id), department_id: num(values.department_id),
        location_id: num(values.location_id),
        initial_value: values.initial_value ?? null, balance_value: values.balance_value ?? null,
      };
      if (actType === 'introduction') await actsAPI.introduction(payload);
      else if (actType === 'transfer') await actsAPI.transfer(payload);
      else if (actType === 'extension') await actsAPI.extension(payload);
      else if (actType === 'write_off') await actsAPI.writeOff(payload);
      message.success('Акт внесено'); setOpen(false); load();
    } catch (e) { message.error(e.response?.data?.message || 'Помилка'); } finally { setSubmitting(false); }
  };

  const columns = [
    { title: 'Номер', dataIndex: 'act_number', key: 'act_number' },
    { title: 'Тип', dataIndex: 'act_type', key: 'act_type', width: 130, render: (t) => <Tag color={ACT_COLOR[t]}>{ACT_LABEL[t]}</Tag> },
    { title: 'Дата акту', dataIndex: 'act_date', key: 'act_date', width: 110, render: (d) => d ? dayjs(d).format('DD.MM.YYYY') : '-' },
    { title: 'Дата дії', dataIndex: 'action_date', key: 'action_date', width: 110, render: (d) => d ? dayjs(d).format('DD.MM.YYYY') : '-' },
    { title: 'Майно', key: 'asset', render: (_, r) => r.inventory_number ? `${r.inventory_number} — ${r.asset_name || ''}` : '-' },
    { title: 'Від / До', key: 'depts', render: (_, r) => [r.from_department_name, r.to_department_name].filter(Boolean).join(' → ') || '-' },
    { title: 'Створив', dataIndex: 'created_by_username', key: 'created_by_username' },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><Title level={2} style={{ margin: 0 }}>Акти</Title><Text type="secondary">Внесення актів: введення / передача / продовження / списання</Text></div>
          <Space>
            <InfoButton title="Акти" items={[
              { title: 'Внести акт', text: 'оберіть тип: введення (нове майно), передача (списує у відправника), продовження (+1 рік), списання.' },
              { title: 'Дата акта vs дата дії', text: 'номер і дата акта — з паперового документа; дата дії над обʼєктом може відрізнятись.' },
              { title: 'Передача', text: 'списує актив у відправнику (статус «передане»). Одержувач вносить отримане окремим актом введення.' },
              { title: 'Локація', text: 'у актах не фігурує — виставляється в картці майна.' },
            ]} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openModal}>Внести акт</Button>
          </Space>
        </div>
        <Card>
          <Space wrap>
            <Select placeholder="Тип акту" allowClear style={{ width: 200 }} value={filterType}
              onChange={(v) => { setFilterType(v); setPagination((p) => ({ ...p, current: 1 })); }}>
              {Object.keys(ACT_LABEL).map((k) => <Select.Option key={k} value={k}>{ACT_LABEL[k]}</Select.Option>)}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={load}>Оновити</Button>
          </Space>
        </Card>
        <Card>
          <Table columns={columns} dataSource={acts} rowKey="act_id" loading={loading} size="middle"
            pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `Всього: ${t}`, onChange: (c) => setPagination((p) => ({ ...p, current: c })) }} />
        </Card>
      </Space>

      <Modal title="Внести акт" open={open} onCancel={() => setOpen(false)} footer={null} width={680}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label="Тип акту" name="act_type" rules={[{ required: true, message: 'Оберіть тип' }]}>
            <Select placeholder="оберіть тип" onChange={(v) => setActType(v)}>
              <Select.Option value="introduction">Введення (нове майно)</Select.Option>
              <Select.Option value="transfer">Передача</Select.Option>
              <Select.Option value="extension">Продовження експлуатації (+1 рік)</Select.Option>
              <Select.Option value="write_off">Списання</Select.Option>
            </Select>
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Номер акту" name="act_number" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item label="Дата акту" name="act_date" rules={[{ required: true }]} style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
            <Form.Item label="Дата дії" name="action_date" style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
          </Space>

          {actType === 'introduction' && (
            <>
              <Space style={{ display: 'flex' }}>
                <Form.Item label="Інвентарний номер" name="inventory_number" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
                <Form.Item label="Найменування" name="name" rules={[{ required: true }]} style={{ flex: 2 }}><Input /></Form.Item>
              </Space>
              <Space style={{ display: 'flex' }}>
                <Form.Item label="Вид" name="asset_type_id" style={{ flex: 1 }}><Select allowClear>{types.map((t) => <Select.Option key={t.type_id} value={t.type_id}>{t.name} ({t.normative_life_years} р.)</Select.Option>)}</Select></Form.Item>
                <Form.Item label="Од." name="unit" style={{ flex: 1 }}><Input /></Form.Item>
                <Form.Item label="К-ть" name="quantity" style={{ flex: 1 }}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
              </Space>
              <Space style={{ display: 'flex' }}>
                <Form.Item label="Первісна" name="initial_value" style={{ flex: 1 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                <Form.Item label="Балансова" name="balance_value" style={{ flex: 1 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                <Form.Item label="Підрозділ" name="department_id" style={{ flex: 1 }}><Select disabled={user?.role !== 'global_admin'}>{departments.map((d) => <Select.Option key={d.department_id} value={d.department_id}>{d.name}</Select.Option>)}</Select></Form.Item>
              </Space>
              <Space style={{ display: 'flex' }}>
                <Form.Item label="Дата первинного введення" name="primary_introduced_date" rules={[{ required: true, message: 'Оберіть дату' }]} style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
                <Form.Item label="Дата введення отриманого (за потреби)" name="secondary_introduced_date" style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
              </Space>
              <Form.Item label="Додатково (МОЛ, серійник, виробник…)" name="additional_info"><Input.TextArea rows={2} /></Form.Item>
            </>
          )}

          {actType === 'transfer' && (
            <>
              <Form.Item label="Майно" name="asset_id" rules={[{ required: true }]}><Select showSearch optionFilterProp="children">{assets.map((a) => <Select.Option key={a.asset_id} value={a.asset_id}>{a.inventory_number} — {a.name}</Select.Option>)}</Select></Form.Item>
              <Form.Item label="Підрозділ-одержувач" name="to_department_id" rules={[{ required: true }]}><Select>{departments.map((d) => <Select.Option key={d.department_id} value={d.department_id}>{d.name}</Select.Option>)}</Select></Form.Item>
            </>
          )}

          {(actType === 'extension' || actType === 'write_off') && (
            <Form.Item label="Майно" name="asset_id" rules={[{ required: true }]}><Select showSearch optionFilterProp="children">{assets.map((a) => <Select.Option key={a.asset_id} value={a.asset_id}>{a.inventory_number} — {a.name}</Select.Option>)}</Select></Form.Item>
          )}

          <Form.Item label="Нотатки" name="notes"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => setOpen(false)}>Скасувати</Button><Button type="primary" htmlType="submit" loading={submitting}>Внести</Button></Space></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ActsPage;
