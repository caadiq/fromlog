import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';

import '../core/constants.dart';
import 'update_info.dart';
import 'update_service.dart';

/// 현재 테마 primary (동적 팔레트)
Color get _accent => appPalette.primary;

Future<void> showUpdateDialog(BuildContext context, UpdateInfo info) {
  return showDialog(
    context: context,
    barrierDismissible: !info.mandatory,
    builder: (_) => UpdateDialog(info: info),
  );
}

class UpdateDialog extends StatefulWidget {
  final UpdateInfo info;
  const UpdateDialog({super.key, required this.info});

  @override
  State<UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<UpdateDialog> {
  StreamSubscription<OtaEvent>? _sub;
  bool _busy = false;
  double _progress = 0;
  String? _error;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _start() {
    setState(() {
      _busy = true;
      _error = null;
      _progress = 0;
    });
    _sub = UpdateService()
        .downloadAndInstall(widget.info)
        .listen(
          (event) {
            switch (event.status) {
              case OtaStatus.DOWNLOADING:
                final p = double.tryParse(event.value ?? '0') ?? 0;
                setState(() => _progress = p / 100);
                break;
              case OtaStatus.INSTALLING:
                setState(() => _progress = 1);
                break;
              case OtaStatus.INSTALLATION_DONE:
                if (mounted) Navigator.of(context).pop();
                break;
              case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
                setState(() {
                  _error = '설치 권한이 필요합니다.\n"출처를 알 수 없는 앱 설치"를 허용해 주세요.';
                  _busy = false;
                });
                break;
              case OtaStatus.CHECKSUM_ERROR:
                setState(() {
                  _error = '파일 검증에 실패했습니다(체크섬 불일치).';
                  _busy = false;
                });
                break;
              default:
                setState(() {
                  _error = '업데이트에 실패했습니다 (${event.status.name}).';
                  _busy = false;
                });
            }
          },
          onError: (e) {
            setState(() {
              _error = '업데이트에 실패했습니다.\n$e';
              _busy = false;
            });
          },
        );
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    return PopScope(
      canPop: !info.mandatory && !_busy,
      child: AlertDialog(
        title: Row(
          children: [
            Icon(Icons.system_update, color: _accent),
            const SizedBox(width: 8),
            Text('새 버전 ${info.versionName}'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (info.mandatory)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '필수 업데이트입니다.',
                  style: TextStyle(color: _accent, fontWeight: FontWeight.bold),
                ),
              ),
            Text(
              info.changelog?.trim().isNotEmpty == true
                  ? info.changelog!.trim()
                  : '새로운 버전이 준비되었습니다.',
            ),
            if (_busy) ...[
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: _progress > 0 ? _progress : null,
                  color: _accent,
                  backgroundColor: _accent.withValues(alpha: 0.15),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _progress >= 1
                    ? '설치 중…'
                    : '다운로드 중… ${(_progress * 100).round()}%',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
            ],
          ],
        ),
        actions: _busy
            ? [
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: _accent,
                    ),
                  ),
                ),
              ]
            : [
                if (!info.mandatory)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text(
                      '나중에',
                      style: TextStyle(color: Colors.black54),
                    ),
                  ),
                FilledButton(
                  onPressed: _start,
                  style: FilledButton.styleFrom(backgroundColor: _accent),
                  child: Text(_error != null ? '다시 시도' : '업데이트'),
                ),
              ],
      ),
    );
  }
}
