import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  monthName?: string
  hoursLogged?: string
  daysLeft?: number
  missingDays?: string[]
  appUrl?: string
}

const MonthEndReminder = ({
  name,
  monthName = 'this month',
  hoursLogged = '0h',
  daysLeft = 5,
  missingDays = [],
  appUrl = 'https://trackhourspro.com/dashboard',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {`${daysLeft} day${daysLeft === 1 ? '' : 's'} left to log your ${monthName} hours`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>TrackHours</Text>
        <Heading style={heading}>
          {daysLeft} day{daysLeft === 1 ? '' : 's'} left to log {monthName} hours
        </Heading>
        <Text style={text}>
          {name ? `Hi ${name},` : 'Hi there,'} the month is nearly closed. Here is where your
          timesheet stands right now.
        </Text>

        <Section style={statBox}>
          <Text style={statLabel}>Logged in {monthName}</Text>
          <Text style={statValue}>{hoursLogged}</Text>
        </Section>

        {missingDays.length > 0 && (
          <Section>
            <Text style={subhead}>Weekdays with no time logged</Text>
            <Text style={text}>{missingDays.join(' · ')}</Text>
          </Section>
        )}

        <Section style={{ paddingTop: '8px', paddingBottom: '8px' }}>
          <Button href={appUrl} style={button}>
            Log your hours
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          You can turn these month-end reminders off any time in Settings.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MonthEndReminder,
  subject: (data: Record<string, any>) =>
    `${data['daysLeft'] ?? 5} days left to log your ${data['monthName'] ?? 'monthly'} hours`,
  displayName: 'Month-end time reminder',
  previewData: {
    name: 'Sami',
    monthName: 'September',
    hoursLogged: '42h 30m',
    daysLeft: 5,
    missingDays: ['Sep 3', 'Sep 9', 'Sep 16'],
    appUrl: 'https://trackhourspro.com/dashboard',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

const container = {
  padding: '32px 28px',
  maxWidth: '560px',
  margin: '0 auto',
}

const brand = {
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#00ba6a',
  margin: '0 0 20px',
}

const heading = {
  fontSize: '22px',
  lineHeight: '30px',
  fontWeight: 700,
  color: '#111827',
  margin: '0 0 12px',
}

const text = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#374151',
  margin: '0 0 14px',
}

const subhead = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#6b7280',
  margin: '18px 0 6px',
}

const statBox = {
  backgroundColor: '#f0fdf6',
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '8px 0 4px',
}

const statLabel = {
  fontSize: '12px',
  color: '#4b5563',
  margin: '0 0 4px',
}

const statValue = {
  fontSize: '26px',
  fontWeight: 700,
  color: '#009254',
  margin: '0',
}

const button = {
  backgroundColor: '#00ba6a',
  color: '#ffffff',
  borderRadius: '10px',
  fontSize: '15px',
  fontWeight: 600,
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '26px 0 14px',
}

const footer = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#9ca3af',
  margin: '0',
}
