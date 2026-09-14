// Source material for the panels.
//
// The reference clip is a collage of real-looking listings — Fortran II,
// x86 assembly, Perl, C++ STL, OpenMP pragmas — set in upper-case on a
// technical mono. These pools reproduce that mix. Blocks are coherent
// (consecutive lines belong together) rather than random character noise,
// which is what makes the wall read as "code" instead of "texture".

import type { Rng } from "./random";
import { intRange, pick, range } from "./random";

const FORTRAN_HERON = `      IF (IA) 777, 777, 701
  701 IF (IB) 777, 777, 702
  702 IF (IC) 777, 777, 703
  703 IF (IA+IB-IC) 777, 777, 704
  704 IF (IA+IC-IB) 777, 777, 705
  705 IF (IB+IC-IA) 777, 777, 799
  777 STOP 1
  799 S = FLOATF (IA + IB + IC) / 2.0
      AREA = SQRTF( S * (S - FLOATF(IA)) *
     +     (S - FLOATF(IB)) *
     +     (S - FLOATF(IC)))
      OUTPUT TAPE 6, 601, IA, IB, IC, AREA
  601 FORMAT (4H A= ,I5,5H  B= ,I5,5H  C= ,I5,
     +   8H  AREA= ,F10.2, 13H SQUARE UNITS)
      STOP
      END
C     A TRIANGLE WITH A STANDARD SQUARE ROOT
C     READS CARD INPUT, TESTS INPUT FOR
C     VALIDITY, THEN PRINTS THE RESULT
C     USING HERON'S FORMULA WE CALCULATE THE
C     AREA OF THE TRIANGLE
      READ INPUT TAPE 5, 501, IA, IB, IC
  501 FORMAT (3I5)
      INTEGER FUNCTION SQRTF (X)`.split("\n");

const ASM_BRANCH = `BT   EAX, 1
JC   ROUTINE_1
BT   EAX, 2
JC   ROUTINE_2
BT   EAX, 3
JC   ROUTINE_3
BT   EAX, 4
JC   ROUTINE_4
XOR  EAX, EAX
RET
ROUTINE_1:
MOV  ESI, OFFSET BUF
CALL FLUSH_LINE
JMP  FAIL_TH
ROUTINE_2:
LEA  EDI, [EBP-40H]
REP  MOVSD
JMP  FAIL_TH`.split("\n");

const ASM_REGS = `MOV AX, 0A1H
MOV BX, 0FFH
MOV CX, 3C0H
MOV DX, 0012H
MOV SI, WORD PTR DS:[BX]
MOV DI, SEG_LIST
INT 21H
CMP AX, BX
JNE $+6
ADD SP, 8
POP BP
MOV CS, [SI]
MOV AH, 4CH
XCHG AX, DX
TEST AL, AL
SHL EDX, 4
OR  EDX, ECX
STOSB`.split("\n");

const PERL_BF = `@CODE = GREP {/^[-+.,\\[\\]<>]/} SPLIT '', <F>;
FOR (MY $I = 0; $I < @CODE; ++$I) {
  --$CPU[$SI] IF $CODE[$I] EQ '-';
  ++$CPU[$SI] IF $CODE[$I] EQ '+';
  --$SI       IF $CODE[$I] EQ '<';
  ++$SI       IF $CODE[$I] EQ '>';
  PRINT CHR $CPU[$SI] IF $CODE[$I] EQ '.';
  $CPU[$SI] = ORD <STDIN>;
  IF ($CODE[$I] EQ '[') {
    IF (!$CPU[$SI]) {
      ++$SKIP;
      WHILE ($SKIP) {
        ++$I;
        ++$SKIP IF $CODE[$I] EQ '[';
        --$SKIP IF $CODE[$I] EQ ']';
      }
    } ELSE {
      PUSH @LOOP, $I;
    }
  }
}`.split("\n");

const CPP_STL = `IF (_ITER == _END) {
  STD::COPY(
    STD::MAKE_MOVE_ITERATOR(_FIRST),
    STD::MAKE_MOVE_ITERATOR(_LAST),
    _TMP_ITER);
  _TMP_ITER += _END;
  BREAK;
}
TEMPLATE <CLASS _IT, CLASS _CMP>
VOID _MERGE_SORT(_IT _F, _IT _L, _CMP _C) {
  CONST DIFF_T _N = STD::DISTANCE(_F, _L);
  IF (_N < 2) RETURN;
  _IT _MID = STD::NEXT(_F, _N / 2);
  _MERGE_SORT(_F, _MID, _C);
  _MERGE_SORT(_MID, _L, _C);
  STD::INPLACE_MERGE(_F, _MID, _L, _C);
}`.split("\n");

const OMP_TASK = `#PRAGMA OMP PARALLEL SHARED(BUF) NUM_THREADS(8)
#PRAGMA OMP SINGLE NOWAIT
#PRAGMA OMP TASK FIRSTPRIVATE (FROM, TO)
  ITERATOR I = FROM;
  STD::ADVANCE(I, FROM, N);
#PRAGMA OMP TASK FIRSTPRIVATE (FROM, TO)
  ITERATOR J = FROM;
  STD::ADVANCE(J, FROM, N);
#PRAGMA OMP TASKWAIT
  REDUCE_RANGE(I, J, ACC);
#PRAGMA OMP BARRIER
  RETURN ACC / STATIC_CAST<DOUBLE>(N);`.split("\n");

const SHELL_OPS = `#!/USR/BIN/PERL -W
/USR/BIN/PERL  /USR/SBIN/INIT
SET +O HISTEXPAND ; UMASK 0027
EXEC 3<> /DEV/TCP/10.0.14.2/8443
PRINTF '%S\\R\\N' "$PAYLOAD" >&3
WHILE READ -R LINE; DO
  [[ $LINE =~ ^ACK ]] && BREAK
DONE <&3
KILL -TERM %1 2>/DEV/NULL
TRAP 'RM -F "$LOCK"' EXIT INT TERM
MKDIR -P /VAR/RUN/TXQ && CD $_
DD IF=/DEV/URANDOM BS=512 COUNT=4`.split("\n");

const SYS_CALLS = `APPENDF( ADDR BUFFER_ADDR COMPAT_DRV
MESSAGEDIR.W ADDR BUFFER,NOWARN MESTITLE,MB_OK
EXTPROCESS.H  EXTPROCESS.BIN
SET_STATE( CTX->PIPE, PIPE_READY );
IOCTL( FD, TIOCGWINSZ, &WS );
MMAP( NULL, LEN, PROT_READ, MAP_SHARED, FD, 0 )
SIGACTION( SIGPIPE, &SA, NULL );
PTHREAD_MUTEX_LOCK( &Q->GUARD );
ATOMIC_FETCH_ADD( &REFCOUNT, 1 );
POLL( PFD, NFDS, TIMEOUT_MS );
WRITEV( SOCK, IOV, IOVCNT );
CLOSE( FD ); FD = -1;`.split("\n");

const FLOAT_TABLE = `VAL 1 (FLOAT) IA .15,5H
 VAL 2 (FLOAT) IB .15,5H
 VAL 3 (FLOAT) IC .15,5H
 AREA = SQRTF ( S *
 (S - FLOATF(IA)) *
 (S - FLOATF(IB)) *
 (S - FLOATF(IC)) )
 706 IF (IA) 777, 777, 701
 788 IF (IB) 777, 777, 702
 799 S = FLOATF (IA + IB + IC) / 2.0
 OUTPUT TAPE 6, 601, IA,
       IB, IC, AREA`.split("\n");

const BLOCKS: readonly (readonly string[])[] = [
  FORTRAN_HERON,
  ASM_BRANCH,
  ASM_REGS,
  PERL_BF,
  CPP_STL,
  OMP_TASK,
  SHELL_OPS,
  SYS_CALLS,
  FLOAT_TABLE,
];

/** A contiguous window of `lines` lines from one of the listings. */
export const codeBlock = (rng: Rng, lines: number): string[] => {
  const block = pick(rng, BLOCKS);
  const start = intRange(rng, 0, Math.max(0, block.length - 1));
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    out.push(block[(start + i) % block.length]);
  }
  return out;
};

const HEX = "0123456789ABCDEF";

/** Dense numeric columns, like the register dumps in the reference. */
export const numberGrid = (rng: Rng, lines: number, cols: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) {
      const kind = rng();
      if (kind < 0.45) {
        cells.push(String(intRange(rng, 100, 999)));
      } else if (kind < 0.8) {
        let hex = "";
        for (let h = 0; h < 3; h++) hex += HEX[intRange(rng, 0, 15)];
        cells.push(hex + "H");
      } else {
        cells.push(range(rng, 0, 99).toFixed(1));
      }
    }
    out.push(cells.join(" "));
  }
  return out;
};

const LABEL_STEMS = [
  "ELEMENTS",
  "DATA",
  "INTERSECT",
  "SEGMENT",
  "KERNEL",
  "BUFFER",
  "MATRIX",
  "STREAM",
  "SECTOR",
  "MODULE",
  "PROCESS",
  "REGISTER",
] as const;

const LABEL_TAILS = ["/TX", "·TXT", "///", " /SEQ", " :TX", "_IDX "] as const;

/** Header strings such as "ELEMENTS /TX03" or "DATA·TXT04". */
export const panelLabel = (rng: Rng): string => {
  const stem = pick(rng, LABEL_STEMS);
  const tail = pick(rng, LABEL_TAILS);
  return `${stem}${tail}${String(intRange(rng, 1, 99)).padStart(2, "0")}`;
};

/** Second-line metadata, e.g. "FIN 5.1 •642   07/02/02". */
export const panelMeta = (rng: Rng): string => {
  const kinds = [
    () =>
      `FIN ${intRange(rng, 1, 9)}.${intRange(rng, 0, 9)} •${intRange(rng, 100, 999)}   ${String(
        intRange(rng, 1, 12),
      ).padStart(2, "0")}/${String(intRange(rng, 1, 28)).padStart(2, "0")}/02`,
    () => `#!/USR/BIN/PERL`,
    () => `MODE ${intRange(rng, 10, 99)}  STACK ${intRange(rng, 100, 999)}`,
    () => `REV ${intRange(rng, 1, 9)}.${intRange(rng, 10, 99)}  NODE ${intRange(rng, 1, 64)}`,
    () => `TX${String(intRange(rng, 0, 99)).padStart(2, "0")} / RDATA ${range(rng, 0, 9).toFixed(1)}`,
  ];
  return pick(rng, kinds)();
};
