import React, { useEffect, useState, useCallback } from 'react';
import { Card, Space, Button, Tag, Select, Typography, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, EditOutlined, ReloadOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { usersAPI, departmentsAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import SmartTable from '../components/SmartTable';

const { Title, Text } = Typography;
const ROLES = [
  { value: 'global_admin', label: 'Глобальний адмін', color: 'orange' },
  { value: 'global_supervisor', label: 'Супервізор', color: 'purple' },
  { value: 'department_admin', label: 'Адмін підрозділу', color: 'green' },
  { value: 'editor', label: 'Редактор', color: 'blue' },
  { value: 'viewer', label: 'Переглядач', color: 'default' },
];
const roleMap = Object.fromEntries(ROLES.map((r) => [r.value, r]));

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [roleFilter, setRoleFilter] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [current, setCurrent] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { user: me } = useAuthStore();
  const isGlobal = me && me.role === 'global_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await usersAPI.getAll({ page: pagination.current, limit: pagination.pageSize, role: roleFilter }); setUsers(r.data.data); setPagination((p) => ({ ...p, total: r.data.pagination.total })); }
    catch (e) { message.error('Помилка'); } finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, roleFilter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { departmentsAPI.getAll().then((r) => setDepartments(r.data)).catch(() => {}); }, []);

  const openCreate = () => { setMode('create'); setCurrent(null); form.resetFields(); form.setFieldsValue({ role: 'viewer', is_active: true, department_id: me && me.departmentId }); setOpen(true); };
  const openEdit = (u) => { setMode('edit'); setCurrent(u); form.setFieldsValue({ ...u }); setOpen(true); };
  const submit = async (values) => {
    setSubmitting(true);
    try {
      const payload = { ...values, department_id: values.department_id ? Number(values.department_id) : undefined };
      if (mode === 'create') await usersAPI.create(payload); else await usersAPI.update(current.user_id, payload);
      message.success('Збережено'); setOpen(false); load();
    } catch (e) { message.error(e.response?.data?.message || 'Помилка'); } finally { setSubmitting(false); }
  };
  const toggle = async (u) => { try { await usersAPI.toggleActive(u.user_id); message.success(u.is_active ? 'Заблоковано' : 'Розблоковано'); load(); } catch (e) { message.error(e.response?.data?.message || 'Не вдалося'); } };

  const columns = [
    { title: 'Логін', dataIndex: 'username', key: 'username', width: 120 },
    { title: 'ПІБ', dataIndex: 'full_name', key: 'full_name', width: 200 },
    { title: 'Роль', dataIndex: 'role', key: 'role', width: 180, render: (r) => { const x = roleMap[r]; return <Tag color={x && x.color}>{(x && x.label) || r}</Tag>; } },
    { title: 'Підрозділ', dataIndex: 'department_name', key: 'department_name', width: 200 },
    { title: 'Статус', dataIndex: 'is_active', key: 'is_active', width: 110, render: (a) => <Tag color={a ? 'green' : 'red'}>{a ? 'Активний' : 'Вимкн.'}</Tag> },
    { title: '', key: 'act', width: 80, fixed: 'right', resizable: false, render: (_, r) => (<Space size="small">
      <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
      <Button type="text" danger={r.is_active} icon={r.is_active ? <LockOutlined /> : <UnlockOutlined />} onClick={() => toggle(r)} title={r.is_active ? 'Заблокувати' : 'Розблокувати'} />
    </Space>) },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><Title level={2} style={{ margin: 0 }}>Користувачі</Title><Text type="secondary">Керування користувачами та ролями</Text></div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Додати</Button>
        </div>
        <Card><Space wrap>
          <Select placeholder="Роль" allowClear style={{ width: 200 }} value={roleFilter} onChange={(v) => { setRoleFilter(v); setPagination((p) => ({ ...p, current: 1 })); }}>{ROLES.map((r) => <Select.Option key={r.value} value={r.value}>{r.label}</Select.Option>)}</Select>
          <Button icon={<ReloadOutlined />} onClick={load}>Оновити</Button>
        </Space></Card>
        <Card>
          <SmartTable
            columns={columns}
            dataSource={users}
            rowKey="user_id"
            loading={loading}
            storageKey="users"
            pagination={pagination}
            onChange={(pag) => setPagination((p) => ({ ...p, current: pag.current, pageSize: pag.pageSize }))}
          />
        </Card>
      </Space>

      <Modal title={mode === 'create' ? 'Новий користувач' : 'Редагувати'} open={open} onCancel={() => setOpen(false)} footer={null} width={520}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label="Логін" name="username" rules={[{ required: true }]}><Input disabled={mode === 'edit'} /></Form.Item>
          <Form.Item label="ПІБ" name="full_name"><Input /></Form.Item>
          <Form.Item label="Роль" name="role" rules={[{ required: true }]}><Select>{ROLES.map((r) => <Select.Option key={r.value} value={r.value}>{r.label}</Select.Option>)}</Select></Form.Item>
          <Form.Item label="Підрозділ" name="department_id"><Select allowClear disabled={!isGlobal}>{departments.map((d) => <Select.Option key={d.department_id} value={d.department_id}>{d.name}</Select.Option>)}</Select></Form.Item>
          <Form.Item label="Пароль" name="password" rules={mode === 'create' ? [{ required: true }, { min: 4 }] : [{ min: 4 }]}><Input.Password placeholder={mode === 'edit' ? 'залиште порожнім, якщо без змін' : ''} /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => setOpen(false)}>Скасувати</Button><Button type="primary" htmlType="submit" loading={submitting}>Зберегти</Button></Space></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
