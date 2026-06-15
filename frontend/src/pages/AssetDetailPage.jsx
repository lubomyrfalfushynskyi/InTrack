import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Typography, Space, Button, Tag, Timeline, Spin, message, Modal, Form, Input, DatePicker, Select, Empty, Table, InputNumber } from 'antd';
import { ArrowLeftOutlined, SwapOutlined, ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { assetsAPI, actsAPI, departmentsAPI, locationsAPI, usersAPI, usageAPI } from '../services/api';
import InfoButton from '../components/InfoButton';

const { Title, Text } = Typography;
const STATUS = { active: { color: 'green', label: 'В експлуатації' }, expired: { color: 'red', label: 'Вичерпано термін' }, transferred: { color: 'orange', label: 'Передане' }, written_off: { color: 'default', label: 'Списане' } };
const ACT_LABEL = { introduction: 'Введення', transfer: 'Передача', extension: 'Продовження', write_off: 'Списання' };
const ACT_COLOR = { introduction: 'green', transfer: 'blue', extension: 'gold', write_off: 'red' };
const MONTHS = ['Січ','Лют','Бер','Квіт','Трав','Черв','Лип','Серп','Вер','Жовт','Лист','Груд'];

const AssetDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [usage, setUsage] = useState([]);
  const [usageModal, setUsageModal] = useState(false);
  const [usageForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [r, u] = await Promise.all([assetsAPI.getById(id), usageAPI.list(id).catch(() => ({ data: [] }))]);
      setData(r.data);
      setUsage(u.data);
    } catch (e) { message.error('Помилка завантаження'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const submitUsage = async (values) => {
    try {
      await usageAPI.add(id, { period_year: values.period_year, period_month: values.period_month, hours: values.hours });
      message.success('Напрацювання внесено'); setUsageModal(false); load();
    } catch (e) { message.error(e.response?.data?.message || 'Помилка'); }
  };

  const openModal = async (type) => {
    form.resetFields();
    form.setFieldsValue({ act_date: dayjs(), action_date: dayjs() });
    setModal(type);
    try {
      const [d, l, u] = await Promise.all([
        departmentsAPI.getAll(),
        locationsAPI.getAll(),
        usersAPI.getAll().catch(() => ({ data: { data: [] } })),
      ]);
      setDepartments(d.data);
      setLocations(l.data);
      setUsers((u.data && (u.data.data || u.data)) || []);
    } catch (e) { /* scoped */ }
  };

  const submit = async (values) => {
    setSubmitting(true);
    try {
      const payload = { ...values, asset_id: Number(id),
        act_date: values.act_date.format('YYYY-MM-DD'),
        action_date: values.action_date ? values.action_date.format('YYYY-MM-DD') : undefined };
      if (modal === 'transfer') await actsAPI.transfer(payload);
      else if (modal === 'extension') await actsAPI.extension(payload);
      else if (modal === 'write_off') await actsAPI.writeOff(payload);
      message.success('Акт внесено'); setModal(null); load();
    } catch (e) { message.error(e.response?.data?.message || 'Помилка'); } finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  const asset = data && data.asset;
  if (!asset) return <Card><Text type="secondary">Майно не знайдено</Text></Card>;
  const eff = asset.effective_status;
  const st = STATUS[eff] || STATUS.active;
  const locStr = [asset.location_building, asset.location_floor && `${asset.location_floor}п`, asset.location_room && `к.${asset.location_room}`].filter(Boolean).join(', ');

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assets')}>Назад</Button>
            <Title level={3} style={{ margin: 0 }}>{asset.inventory_number}</Title>
            <Tag color={st.color}>{st.label}</Tag>
            {asset.remaining_life_years !== null && asset.remaining_life_years !== undefined && (
              <Text style={{ color: asset.remaining_life_years < 0 ? '#cf1322' : undefined }}>залишковий строк: {asset.remaining_life_years} р.</Text>
            )}
          </Space>
          <Space wrap>
            <InfoButton title="Картка майна" items={[
              { title: 'Дії', text: 'Передати (списує у вашому підрозділі), Продовжити (+1 рік), Списати — доступні для придатного/простроченого.' },
              { title: 'Локація', text: 'змінюється тут, у картці (напряму). Редактор міняє локацію вільно, інші колонки — через акти.' },
              { title: 'Хронологія', text: 'усі акти одиниці у часі.' },
            ]} />
            {(eff === 'active' || eff === 'expired') && (
              <>
                <Button icon={<SwapOutlined />} onClick={() => openModal('transfer')}>Передати</Button>
                {eff === 'expired' && <Button icon={<ClockCircleOutlined />} onClick={() => openModal('extension')}>Продовжити термін</Button>}
                <Button danger icon={<DeleteOutlined />} onClick={() => openModal('write_off')}>Списати</Button>
              </>
            )}
          </Space>
        </div>

        <Card title="Деталі">
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Найменування" span={2}>{asset.name}</Descriptions.Item>
            <Descriptions.Item label="Вид">{asset.type_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Кількість / од.">{asset.quantity} {asset.unit}</Descriptions.Item>
            <Descriptions.Item label="Первісна вартість">{asset.initial_value ? `${Number(asset.initial_value).toLocaleString('uk-UA')} ₴` : '-'}</Descriptions.Item>
            <Descriptions.Item label="Балансова вартість">{asset.balance_value ? `${Number(asset.balance_value).toLocaleString('uk-UA')} ₴` : '-'}</Descriptions.Item>
            <Descriptions.Item label="Підрозділ">{asset.department_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Приміщення">{locStr || '-'}</Descriptions.Item>
            <Descriptions.Item label="Утримувач">{asset.responsible_full_name || asset.responsible_username || '-'}</Descriptions.Item>
            <Descriptions.Item label="Дата введення (первісна)">{asset.primary_introduced_date ? dayjs(asset.primary_introduced_date).format('DD.MM.YYYY') : '-'}</Descriptions.Item>
            <Descriptions.Item label="Дата введення (після передачі)">{asset.secondary_introduced_date ? dayjs(asset.secondary_introduced_date).format('DD.MM.YYYY') : '-'}</Descriptions.Item>
            <Descriptions.Item label="Актів продовження">{asset.extension_count || 0}</Descriptions.Item>
            <Descriptions.Item label="Залишковий строк (років)">{asset.remaining_life_years !== null && asset.remaining_life_years !== undefined ? `${asset.remaining_life_years} р.` : '-'}</Descriptions.Item>
            <Descriptions.Item label="Напрацювання / норматив (год)">{(asset.usage_hours_total ? Number(asset.usage_hours_total).toLocaleString('uk-UA') : '0')} / {asset.type_normative_hours ? Number(asset.type_normative_hours).toLocaleString('uk-UA') : '—'}{(asset.remaining_hours !== null && asset.remaining_hours !== undefined) ? ` (залишок ${asset.remaining_hours})` : ''}</Descriptions.Item>
            <Descriptions.Item label="Нотатки">{asset.notes || '-'}</Descriptions.Item>
            <Descriptions.Item label="Додатково (серійник, виробник, рік випуску, паспорт, склад комплекту)" span={2}>{asset.additional_info || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Журнал напрацювання (за місяцями)" extra={<Button size="small" icon={<ClockCircleOutlined />} onClick={() => { usageForm.resetFields(); usageForm.setFieldsValue({ period_year: dayjs().year(), period_month: dayjs().month() + 1, hours: 0 }); setUsageModal(true); }}>Внести місяць</Button>}>
          <Table size="small" rowKey="usage_id" pagination={false} dataSource={usage}
            columns={[
              { title: 'Рік', dataIndex: 'period_year', width: 70 },
              { title: 'Місяць', dataIndex: 'period_month', width: 80, render: (m) => MONTHS[(m - 1)] || m },
              { title: 'Години', dataIndex: 'hours', width: 100, render: (h) => Number(h).toLocaleString('uk-UA') },
              { title: 'Хто вніс', key: 'who', render: (_, r) => r.entered_by_full_name || r.entered_by_username || '-' },
              { title: 'Коли', dataIndex: 'entered_at', render: (t) => t ? dayjs(t).format('DD.MM.YYYY HH:mm') : '-' },
            ]}
            locale={{ emptyText: 'Записів напрацювання немає' }} />
        </Card>

        <Card title="Хронологія актів">
          {data.history && data.history.length ? (
            <Timeline mode="left">
              {data.history.map((a) => (
                <Timeline.Item key={a.act_id} color={ACT_COLOR[a.act_type]} label={a.act_date ? dayjs(a.act_date).format('DD.MM.YYYY') : ''}>
                  <Text strong>{ACT_LABEL[a.act_type]}</Text> №{a.act_number}
                  {a.action_date && <Text type="secondary"> (дія: {dayjs(a.action_date).format('DD.MM.YYYY')})</Text>}
                  {a.from_department_name && <div><Text type="secondary">від: {a.from_department_name}</Text></div>}
                  {a.to_department_name && <div><Text type="secondary">до: {a.to_department_name}</Text></div>}
                  {a.responsible_full_name && <div><Text type="secondary">одержувач: {a.responsible_full_name}</Text></div>}
                  {a.notes && <div><Text type="secondary">{a.notes}</Text></div>}
                </Timeline.Item>
              ))}
            </Timeline>
          ) : <Empty description="Актів немає" />}
        </Card>

        {data.logs && data.logs.length > 0 && (
          <Card title="Журнал змін" size="small">
            {data.logs.map((l) => (
              <div key={l.log_id}><Tag>{l.action_type}</Tag> <Text type="secondary">{l.username || '?'} — {dayjs(l.timestamp).format('DD.MM.YYYY HH:mm')}</Text></div>
            ))}
          </Card>
        )}
      </Space>

      <Modal title={modal === 'transfer' ? 'Акт передачі' : modal === 'extension' ? 'Акт продовження експлуатації' : 'Акт списання'} open={!!modal} onCancel={() => setModal(null)} footer={null} width={560}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Номер акту" name="act_number" rules={[{ required: true, message: 'Введіть номер' }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item label="Дата акту" name="act_date" rules={[{ required: true }]} style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
            <Form.Item label="Дата дії" name="action_date" style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
          </Space>
          {modal === 'transfer' && (
            <>
              <Form.Item label="Підрозділ-одержувач" name="to_department_id" rules={[{ required: true }]}><Select>{departments.map((d) => <Select.Option key={d.department_id} value={d.department_id}>{d.name}</Select.Option>)}</Select></Form.Item>
              <Form.Item label="Утримувач (одержувач)" name="responsible_user_id"><Select allowClear>{users.map((u) => <Select.Option key={u.user_id} value={u.user_id}>{u.full_name || u.username}</Select.Option>)}</Select></Form.Item>
            </>
          )}
          <Form.Item label="Нотатки" name="notes"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => setModal(null)}>Скасувати</Button><Button type="primary" htmlType="submit" loading={submitting}>Внести</Button></Space></Form.Item>
        </Form>
      </Modal>

      <Modal title="Внести напрацювання за місяць" open={usageModal} onCancel={() => setUsageModal(false)} footer={null} width={420}>
        <Form form={usageForm} layout="vertical" onFinish={submitUsage}>
          <Space style={{ display: 'flex' }}>
            <Form.Item label="Рік" name="period_year" rules={[{ required: true }]} style={{ flex: 1 }}><InputNumber min={2000} max={2100} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label="Місяць" name="period_month" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select>{MONTHS.map((m, i) => <Select.Option key={i + 1} value={i + 1}>{m}</Select.Option>)}</Select>
            </Form.Item>
          </Space>
          <Form.Item label="Години напрацювання" name="hours" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => setUsageModal(false)}>Скасувати</Button><Button type="primary" htmlType="submit">Внести</Button></Space></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetDetailPage;
