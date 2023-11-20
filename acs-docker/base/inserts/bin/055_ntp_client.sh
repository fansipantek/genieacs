#!/bin/sh

rm /etc/localtime
ln -s /usr/share/zoneinfo/Canada/Eastern /etc/localtime
ntpdate ca.pool.ntp.org
