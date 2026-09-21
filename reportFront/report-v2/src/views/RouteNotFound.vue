<script setup>
import { ERROR_KINDS, reportRouteQueryFromLocation } from '@/api/reportClient.js'
import ReportErrorState from '@/components/ReportErrorState.vue'

const reportQuery = reportRouteQueryFromLocation()
const homeRoute = reportQuery.reportId ? { name: 'home', query: reportQuery } : null
</script>

<template>
  <ReportErrorState :kind="ERROR_KINDS.ROUTE_NOT_FOUND" :back-to="homeRoute" back-label="返回报告首页" />
</template>
