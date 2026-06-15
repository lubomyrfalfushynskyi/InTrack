import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Card, Space, Input, Button, Tag, Select, Typography, Modal, Form, InputNumber, DatePicker, message } from 'antd';
import { SearchOutlined, PlusOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { assetsAPI, actsAPI, assetTypesAPI, departmentsAPI, usersAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import InfoButton from '../components/InfoButton';
import ResizableTitle from '../components/ResizableTitle';

const { Title, Text } = Typography;
const { Search } = Input;

const STATUS = {
  active: { color: 'green', label: 'В експлуатації' },
  expired: { color: 'red', label: 'Вичерпано термін' },
  transferred: { color: 'orange', label: 'Передане' },
  written_off: { color: 'default', label: 'Списане' },
};

const AssetsPage = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [introOpen, setIntroOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [types, setTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const canPickResponsible = user && (user.role === 'global_admin' || user.role === 'department_admin');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assetsAPI.getAll({ page: pagination.current, limit: pagination.pageSize, search, ...filters });
      setAssets(res.data.data);
      setPagination((p) => ({ ...p, total: res.data.pagination.total }));
    } catch (e) { message.error('Помилка завантаження'); } finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { assetTypesAPI.getAll().then((r) => setTypes(r.data)).catch(() => {}); }, []);

  const openIntro = async () => {
    form.resetFields();
    form.setFieldsValue({ act_date: dayjs(), action_date: dayjs(), primary_introduced_date: dayjs(), unit: 'шт.', quantity: 1 });
    setIntroOpen(true);
    try {
      const [, d] = await Promise.all([assetTypesAPI.getAll(), departmentsAPI.getAll()]);
      setDepartments(d.data);
      if (canPickResponsible) {
        const u = await usersAPI.getAll({ limit: 500 });
        setUsers((u.data && (u.data.data || u.data)) || []);
      }
    } catch (e) { /* scoped */ }
  };

  const submitIntro = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        act_date: values.act_date.format('YYYY-MM-DD'),
        action_date: values.action_date ? values.action_date.format('YYYY-MM-DD') : undefined,
        primary_introduced_date: values.primary_introduced_date ? values.primary_introduced_date.format('YYYY-MM-DD') : undefined,
        secondary_introduced_date: values.secondary_introduced_date ? values.secondary_introduced_date.format('YYYY-MM-DD') : undefined,
        responsible_user_id: values.responsible_user_id || undefined,
        initial_value: values.initial_value ?? null,
        balance_value: values.balance_value ?? null,
      };
      await actsAPI.introduction(payload);
      message.success('Майно внесено (акт введення)');
      setIntroOpen(false);
      load();
    } catch (e) { message.error(e.response?.data?.message || 'Помилка'); } finally { setSubmitting(false); }
  };

  const baseColumns = [
    { title: 'Інв. номер', dataIndex: 'inventory_number', key: 'inventory_number', width: 130, sorter: true,
      render: (t, r) => <a onClick={() => navigate(`/assets/${r.asset_id}`)}>{t}</a> },
    { title: 'Найменування', dataIndex: 'name', key: 'name', ellipsis: true, sorter: true, defaultSortOrder: 'ascend', width: 200 },
    { title: 'Вид', dataIndex: 'type_name', key: 'type_name', ellipsis: true, width: 180, sorter: true },
    { title: 'К-ть', dataIndex: 'quantity', key: 'quantity', width: 60 },
    { title: 'Утримувач', key: 'resp', width: 160, sorter: true, render: (_, r) => r.responsible_full_name || r.responsible_username || '-' },
    { title: 'Підрозділ', dataIndex: 'department_name', key: 'department_name', width: 180, sorter: true },
    { title: 'Приміщення', key: 'location', width: 200,
      render: (_, r) => [r.location_building, r.location_floor && `${r.location_floor} п.`, r.location_room && `к. ${r.location_room}`].filter(Boolean).join(', ') || '-' },
    { title: 'Стан', dataIndex: 'effective_status', key: 'effective_status', width: 170, sorter: true,
      render: (s, r) => {
        if (s === 'expired') return <Tag color="red">Вичерпано термін: {Math.abs(Number(r.remaining_life_years))} р.</Tag>;
        const st = STATUS[s] || STATUS.active; return <Tag color={st.color}>{st.label}</Tag>;
      } },
    { title: 'Залишк. строк', dataIndex: 'remaining_life_years', key: 'remaining_life_years', width: 120, sorter: true,
      render: (v) => v === null || v === undefined ? '—' : <span style={{ color: v < 0 ? '#cf1322' : undefined, fontWeight: v < 0 ? 600 : undefined }}>{v} р.</span> },
    { title: 'Напрацюв. год', key: 'usage', width: 130,
      render: (_, r) => (r.usage_hours_total && r.type_normative_hours) ? `${Number(r.usage_hours_total).toLocaleString('uk-UA')} / ${Number(r.type_normative_hours).toLocaleString('uk-UA')}` : (r.usage_hours_total ? Number(r.usage_hours_total).toLocaleString('uk-UA') : '—') },
    { title: 'Балансова', dataIndex: 'balance_value', key: 'balance_value', width: 130, sorter: true,
      render: (v) => v ? `${Number(v).toLocaleString('uk-UA')} ₴` : '-' },
    { title: '', key: 'act', width: 50, fixed: 'right',
      render: (_, r) => <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/assets/${r.asset_id}`)} /> },
  ];

  // ресайз колонок
  const [colWidths, setColWidths] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assets_col_widths') || 'null') || {}; } catch (e) { return {}; }
  });
  const onResize = (key) => (_, { size }) => {
    setColWidths((prev) => { const next = { ...prev, [key]: size.width }; localStorage.setItem('assets_col_widths', JSON.stringify(next)); return next; });
  };
  const columns = useMemo(() => baseColumns.map((col) => {
    const w = colWidths[col.key] != null ? colWidths[col.key] : col.width;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: onResize(col.key) }) };
  }), [colWidths]);

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><Title level={2} style={{ margin: 0 }}>Майно</Title><Text type="secondary">Облік одиниць майна</Text></div>
          <Space>
            <InfoButton title="Майно" items={[
              { title: 'Список', text: 'тут усі одиниці вашої області видимості. Прострочені — червоним, передані — помаранчевим, списані — сірим.' },
              { title: 'Додати майно', text: 'через акт введення: інв.номер, найменування, вид (дає нормативний строк), дати введення, утримувач (за замов. = ви).' },
              { title: 'Локація', text: 'приміщення виставляється/змінюється в картці одиниці (напряму), не через акти.' },
              { title: 'Фільтри', text: 'стан (придатне/прострочене/передане/списане), вид, пошук за інв.номером чи найменуванням.' },
            ]} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openIntro}>Додати майно</Button>
          </Space>
        </div>

        <Card>
          <Space wrap>
            <Search placeholder="Пошук за інв. номером / найменуванням" allowClear style={{ width: 300 }}
              onSearch={(v) => { setSearch(v); setPagination((p) => ({ ...p, current: 1 })); }} enterButton={<SearchOutlined />} />
            <Select placeholder="Стан" allowClear style={{ width: 150 }}
              onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPagination((p) => ({ ...p, current: 1 })); }}>
              <Select.Option value="active">Придатне</Select.Option>
              <Select.Option value="expired">Прострочене</Select.Option>
              <Select.Option value="transferred">Передане</Select.Option>
              <Select.Option value="written_off">Списане</Select.Option>
            </Select>
            <Select placeholder="Вид" allowClear style={{ width: 180 }}
              onChange={(v) => { setFilters((f) => ({ ...f, type_id: v })); setPagination((p) => ({ ...p, current: 1 })); }}>
              {types.map((t) => <Select.Option key={t.type_id} value={t.type_id}>{t.name}</Select.Option>)}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={load}>Оновити</Button>
          </Space>
        </Card>

        <Card>
          <Table
            columns={columns} dataSource={assets} rowKey="asset_id" loading={loading}
            components={{ header: { cell: ResizableTitle } }}
            rowClassName={(r) => {
              if (r.effective_status === 'expired') return 'row-expired';
              if (r.effective_status === 'written_off') return 'row-written-off';
              if (r.effective_status === 'transferred') return 'row-transferred';
              if (r.remaining_hours !== null && r.remaining_hours !== undefined && Number(r.remaining_hours) <= 0) return 'row-expired';
              return '';
            }}
            onChange={(pag, _f, sorter) => {
              setPagination((p) => ({ ...p, current: pag.current, pageSize: pag.pageSize }));
              if (sorter && sorter.field) {
                setFilters((f) => ({ ...f, sort_by: sorter.field, sort_order: sorter.order === 'ascend' ? 'ASC' : 'DESC' }));
              }
            }}
            pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `Всього: ${t}` }}
            size="middle" scroll={{ x: 'max-content' }}
          />
        </Card>
      </Space>

      <Modal title="Акт введення в експлуатацію (нове майно)" open={introOpen} onCancel={() => setIntroOpen(false)} footer={null} width={680}>
        <Form form={form} layout="vertical" onFinish={submitIntro}>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Номер акту" name="act_number" rules={[{ required: true, message: 'Введіть номер' }]} style={{ flex: 1 }}><Input placeholder="напр. ВВ-2026-001" /></Form.Item>
            <Form.Item label="Дата акту" name="act_date" rules={[{ required: true }]} style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
            <Form.Item label="Дата дії (якщо інша)" name="action_date" style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Інвентарний номер" name="inventory_number" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item label="Найменування" name="name" rules={[{ required: true }]} style={{ flex: 2 }}><Input /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Вид майна" name="asset_type_id" style={{ flex: 1 }}>
              <Select placeholder="оберіть вид" allowClear>{types.map((t) => <Select.Option key={t.type_id} value={t.type_id}>{t.name} ({t.normative_life_years} р.)</Select.Option>)}</Select>
            </Form.Item>
            <Form.Item label="Одиниця" name="unit" style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item label="Кількість" name="quantity" style={{ flex: 1 }}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Первісна вартість" name="initial_value" style={{ flex: 1 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label="Балансова вартість" name="balance_value" style={{ flex: 1 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Дата первинного введення" name="primary_introduced_date" rules={[{ required: true, message: 'Оберіть дату' }]} style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
            <Form.Item label="Дата введення отриманого (за потреби)" name="secondary_introduced_date" style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Підрозділ" name="department_id" style={{ flex: 1 }}>
              <Select placeholder="підрозділ" disabled={user?.role !== 'global_admin'}>{departments.map((d) => <Select.Option key={d.department_id} value={d.department_id}>{d.name}</Select.Option>)}</Select>
            </Form.Item>
            {canPickResponsible && (
              <Form.Item label="Утримувач (за замов. = ви)" name="responsible_user_id" style={{ flex: 1 }}>
                <Select placeholder="оберіть утримувача" allowClear>{users.map((u) => <Select.Option key={u.user_id} value={u.user_id}>{u.full_name || u.username}</Select.Option>)}</Select>
              </Form.Item>
            )}
          </Space>
          <Form.Item label="Додатково (МОЛ, серійник, виробник, рік випуску, склад комплекту…)" name="additional_info"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setIntroOpen(false)}>Скасувати</Button><Button type="primary" htmlType="submit" loading={submitting}>Внести</Button></Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetsPage;
